const VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main(){
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 frag;
uniform sampler2D u_prev;
uniform sampler2D u_fft;
uniform vec2 u_res;
uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_treb;
uniform float u_amp;
uniform int u_preset;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

float fftAt(float x){
  return texture(u_fft, vec2(clamp(x, 0.001, 0.999), 0.5)).r;
}

vec2 kaleido(vec2 p, float slices){
  float a = atan(p.y, p.x);
  float r = length(p);
  float tw = 6.2831853 / max(slices, 2.0);
  a = mod(a, tw);
  a = abs(a - tw * 0.5);
  return vec2(cos(a), sin(a)) * r;
}

void main(){
  vec2 uv = v_uv;
  vec2 p = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  float t = u_time;
  float bass = u_bass;
  float mid = u_mid;
  float treb = u_treb;
  float beat = bass * 0.55 + u_amp * 0.45;

  vec2 q = p;
  int preset = u_preset % 5;

  if (preset == 0) {
    float z = 0.97 - beat * 0.08;
    float ang = t * 0.07 + bass * 0.4;
    float c = cos(ang), s = sin(ang);
    q = mat2(c, -s, s, c) * (p * z);
    q += 0.012 * vec2(sin(t * 0.3 + p.y * 4.0), cos(t * 0.25 + p.x * 3.0));
  } else if (preset == 1) {
    q = kaleido(p, 6.0 + floor(mid * 4.0));
    float z = 0.96 - beat * 0.06;
    q *= z;
    q += 0.02 * vec2(sin(t * 0.4), cos(t * 0.35));
  } else if (preset == 2) {
    float r = length(p);
    float a = atan(p.y, p.x) + t * 0.12 + bass * 0.5;
    q = vec2(cos(a), sin(a)) * (r * (0.94 - beat * 0.1) + 0.02 * sin(r * 12.0 - t));
  } else if (preset == 3) {
    q.x += 0.04 * sin(p.y * 8.0 + t * 0.8) * (0.3 + treb);
    q.y += 0.04 * cos(p.x * 7.0 - t * 0.6) * (0.3 + mid);
    q *= 0.98 - beat * 0.05;
  } else {
    float r = length(p) + 0.0001;
    q = p / r * (r - 0.03 - beat * 0.04);
    float ang = 0.04 * sin(t * 0.5);
    float c = cos(ang), s = sin(ang);
    q = mat2(c,-s,s,c) * q;
  }

  vec2 sampleUv = q / vec2(u_res.x / u_res.y, 1.0) + 0.5;
  sampleUv = mix(sampleUv, uv, 0.04);
  vec3 prev = texture(u_prev, clamp(sampleUv, 0.002, 0.998)).rgb;
  prev *= 0.92 - bass * 0.04;

  float r = length(p);
  float ang = atan(p.y, p.x);
  float wave = fftAt(fract(ang / 6.2831853));
  float ring = abs(r - (0.22 + bass * 0.18 + 0.08 * sin(t * 0.7))) - 0.012 - wave * 0.08;
  float line = smoothstep(0.04, 0.0, ring);

  float spectrum = 0.0;
  for (int i = 0; i < 24; i++) {
    float fi = float(i) / 24.0;
    float mag = fftAt(fi * fi);
    float a0 = (fi - 0.5) * 6.2831853 + t * 0.05;
    vec2 sp = vec2(cos(a0), sin(a0)) * (0.08 + mag * 0.55);
    spectrum += smoothstep(0.04, 0.0, length(p - sp));
  }

  vec3 ink = vec3(0.86, 0.90, 0.88);
  vec3 ember = vec3(0.72, 0.78, 0.76);
  vec3 deep = vec3(0.05, 0.06, 0.07);
  vec3 col = mix(ember, ink, clamp(treb * 1.4, 0.0, 1.0));
  vec3 add = col * (line * (0.55 + treb) + spectrum * 0.35);

  float grain = (hash(gl_FragCoord.xy + t) - 0.5) * 0.03;
  vec3 outc = prev * 0.96 + add;
  outc = mix(deep, outc, 0.98);
  float vig = smoothstep(1.25, 0.25, r);
  outc *= vig;
  outc += grain;
  frag = vec4(clamp(outc, 0.0, 1.0), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("shader");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? "compile failed";
    gl.deleteShader(sh);
    throw new Error(log);
  }
  return sh;
}

export class MilkVis {
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  fftTex: WebGLTexture;
  fbos: { tex: WebGLTexture; fb: WebGLFramebuffer }[];
  ping = 0;
  w = 1;
  h = 1;
  preset = 0;
  fftData = new Uint8Array(256);
  private loc: Record<string, WebGLUniformLocation | null>;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;
    const vs = compile(gl, gl.VERTEX_SHADER, VS);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
    const prog = gl.createProgram();
    if (!prog) throw new Error("program");
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) ?? "link failed");
    }
    this.prog = prog;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.fftTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.fftTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.fbos = [this.makeTarget(64, 64), this.makeTarget(64, 64)];
    this.loc = {
      u_prev: gl.getUniformLocation(prog, "u_prev"),
      u_fft: gl.getUniformLocation(prog, "u_fft"),
      u_res: gl.getUniformLocation(prog, "u_res"),
      u_time: gl.getUniformLocation(prog, "u_time"),
      u_bass: gl.getUniformLocation(prog, "u_bass"),
      u_mid: gl.getUniformLocation(prog, "u_mid"),
      u_treb: gl.getUniformLocation(prog, "u_treb"),
      u_amp: gl.getUniformLocation(prog, "u_amp"),
      u_preset: gl.getUniformLocation(prog, "u_preset"),
    };
  }

  private makeTarget(w: number, h: number) {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb };
  }

  resize(w: number, h: number) {
    const tw = Math.max(64, Math.min(1280, w));
    const th = Math.max(64, Math.min(720, h));
    if (tw === this.w && th === this.h) return;
    this.w = tw;
    this.h = th;
    this.fbos.forEach((f) => {
      this.gl.deleteTexture(f.tex);
      this.gl.deleteFramebuffer(f.fb);
    });
    this.fbos = [this.makeTarget(tw, th), this.makeTarget(tw, th)];
  }

  frame(
    time: number,
    freq: Uint8Array,
    bass: number,
    mid: number,
    treb: number,
    amp: number,
    canvasW: number,
    canvasH: number,
  ) {
    const gl = this.gl;
    this.resize(canvasW, canvasH);
    const n = Math.min(256, freq.length);
    for (let i = 0; i < n; i++) this.fftData[i] = freq[i] ?? 0;

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fftTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      n,
      1,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      this.fftData.subarray(0, n),
    );

    const src = this.fbos[this.ping]!;
    const dst = this.fbos[1 - this.ping]!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(this.loc.u_prev, 0);
    gl.uniform1i(this.loc.u_fft, 1);
    gl.uniform2f(this.loc.u_res, this.w, this.h);
    gl.uniform1f(this.loc.u_time, time);
    gl.uniform1f(this.loc.u_bass, bass);
    gl.uniform1f(this.loc.u_mid, mid);
    gl.uniform1f(this.loc.u_treb, treb);
    gl.uniform1f(this.loc.u_amp, amp);
    gl.uniform1i(this.loc.u_preset, this.preset);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvasW, canvasH);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dst.tex);
    gl.uniform2f(this.loc.u_res, canvasW, canvasH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.ping = 1 - this.ping;
  }

  destroy() {
    const gl = this.gl;
    this.fbos.forEach((f) => {
      gl.deleteTexture(f.tex);
      gl.deleteFramebuffer(f.fb);
    });
    gl.deleteTexture(this.fftTex);
    gl.deleteProgram(this.prog);
  }
}

export const PRESET_NAMES = [
  "Drift",
  "Kaleid",
  "Spiral",
  "Ripple",
  "Pull",
] as const;
