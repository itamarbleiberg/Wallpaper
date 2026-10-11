// v4 shader wallpapers (14 new, all original). Appended to SHADER_LIBRARY.
// Each gets the shared LIB helpers prepended via sh2().
import type { LibraryShader } from "./shaderLibrary";

const LIB = /* glsl */ `
float hash11(float p){p=fract(p*0.1031);p*=p+33.33;p*=p+p;return fract(p);}
float hash21(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.0,a=0.5;mat2 r=mat2(0.8,0.6,-0.6,0.8);for(int i=0;i<5;i++){v+=a*noise(p);p=r*p*2.02+1.7;a*=0.5;}return v;}
float bass(){return texture(iChannel0,vec2(0.04,0.5)).r;}
vec2 mouseUv(){return iMouse.x<=0.0&&iMouse.y<=0.0?vec2(0.5):iMouse.xy/iResolution.xy;}
`;
const sh2 = (b: string) => (LIB + b).trim();

const starfield = sh2(`
void mainImage(out vec4 o, in vec2 fc){
  vec2 uv=(fc-0.5*iResolution.xy)/iResolution.y;
  vec2 m=(mouseUv()-0.5);
  float t=iTime*0.15;
  vec3 col=vec3(0.0);
  for(int i=0;i<60;i++){
    float fi=float(i);
    float z=fract(fi*0.137+t);           // depth 0..1 toward viewer
    float br=1.0-z;
    vec2 dir=normalize(hash22(vec2(fi,fi*1.7))-0.5);
    vec2 p=dir*(0.05/z) + m*(0.3*z);
    float d=length(uv-p);
    float sz=0.004/z;
    col+=vec3(0.7,0.8,1.0)*smoothstep(sz,0.0,d)*br*br*2.0;
    // streak toward center for warp feel
    col+=vec3(0.4,0.5,0.9)*smoothstep(sz*3.0,0.0,abs(dot(uv-p,vec2(-dir.y,dir.x))))*smoothstep(0.3,0.0,length(uv-p))*br*0.3;
  }
  col+=vec3(0.02,0.03,0.06);
  o=vec4(col,1.0);
}`);

const matrixGlobe = sh2(`
void mainImage(out vec4 o,in vec2 fc){
  vec2 uv=(fc-0.5*iResolution.xy)/iResolution.y;
  vec2 m=(mouseUv()-0.5)*3.14159;
  float r=length(uv);
  vec3 col=vec3(0.0,0.02,0.01);
  if(r<0.4){
    vec3 sp=vec3(uv/0.4,sqrt(max(0.0,1.0-dot(uv/0.4,uv/0.4))));
    float lon=atan(sp.x,sp.z)+iTime*0.3+m.x;
    float lat=asin(clamp(sp.y,-1.0,1.0));
    vec2 g=vec2(lon,lat)*vec2(6.0,8.0);
    float cell=hash21(floor(g)+floor(iTime*4.0)*0.0);
    float ch=step(0.5,hash21(floor(g)+floor(iTime*6.0+lon)));
    float grid=step(0.75,fract(g.y));
    float fres=pow(1.0-sp.z,2.0);
    col+=vec3(0.1,1.0,0.4)*ch*grid*(0.5+0.5*sp.z);
    col+=vec3(0.0,0.6,0.3)*fres;
  }
  col+=vec3(0.0,0.5,0.2)*smoothstep(0.42,0.4,r)*smoothstep(0.38,0.4,r);
  o=vec4(col,1.0);
}`);

const cells = sh2(`
void mainImage(out vec4 o,in vec2 fc){
  vec2 uv=fc/iResolution.y;
  vec2 m=mouseUv()*iResolution.xy/iResolution.y;
  float t=iTime*0.2;
  vec2 p=uv*5.0;
  float d1=8.0,d2=8.0;vec2 id=vec2(0.0);
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 g=floor(p)+vec2(x,y);
    vec2 c=g+0.5+0.4*sin(t+6.2831*hash22(g));
    float dd=length(p-c);
    if(dd<d1){d2=d1;d1=dd;id=g;}else if(dd<d2)d2=dd;
  }
  float edge=smoothstep(0.0,0.08,d2-d1);
  float glow=exp(-length(uv*iResolution.y/iResolution.y - m)*2.0);
  vec3 base=0.5+0.5*cos(6.2831*(hash21(id)*vec3(1.0)+vec3(0.0,0.33,0.67))+t);
  vec3 col=base*(0.3+0.7*edge);
  col+=(1.0-edge)*vec3(0.9)*0.4;
  col*=0.8+bass()*0.6+glow*0.5;
  o=vec4(col,1.0);
}`);

const mandala = sh2(`
void mainImage(out vec4 o,in vec2 fc){
  vec2 uv=(fc-0.5*iResolution.xy)/iResolution.y;
  vec2 m=mouseUv()-0.5;
  float a=atan(uv.y,uv.x), r=length(uv);
  float seg=12.0;
  a=abs(mod(a,6.2831/seg)-3.14159/seg);
  vec2 p=vec2(cos(a),sin(a))*r;
  float t=iTime*0.2;
  float v=0.0;
  for(int i=1;i<6;i++){float fi=float(i);
    v+=sin(p.x*fi*6.0+t*fi+length(m)*10.0)*cos(p.y*fi*6.0-t*fi)/fi;
  }
  float ring=sin(r*30.0-t*4.0);
  vec3 col=0.5+0.5*cos(6.2831*(v*0.3+r+vec3(0.0,0.33,0.67))+t);
  col*=0.6+0.4*ring;
  col*=smoothstep(0.9,0.1,r);
  col*=1.0+bass();
  o=vec4(max(col,0.0),1.0);
}`);

const fluidInk = sh2(`
void mainImage(out vec4 o,in vec2 fc){
  vec2 uv=fc/iResolution.xy;
  float asp=iResolution.x/iResolution.y;
  vec2 m=mouseUv();
  vec2 p=vec2(uv.x*asp,uv.y)*2.0;
  float t=iTime*0.1;
  vec2 dm=(uv-m)*vec2(asp,1.0);
  for(int i=0;i<4;i++){float fi=float(i);
    p+=0.4/(fi+1.0)*vec2(sin(fi*p.y*1.5+t*2.0),cos(fi*p.x*1.5+t*1.7));
  }
  p+=0.5*normalize(dm+1e-4)*exp(-dot(dm,dm)*8.0);
  float v=fbm(p+t);
  vec3 a=vec3(0.1,0.2,0.6),b2=vec3(0.9,0.3,0.5),c=vec3(0.95,0.8,0.3);
  vec3 col=mix(a,b2,smoothstep(0.3,0.6,v));
  col=mix(col,c,smoothstep(0.6,0.85,v));
  col+=vec3(0.1)*fbm(p*4.0);
  o=vec4(col,1.0);
}`);

const clouds = sh2(`
void mainImage(out vec4 o,in vec2 fc){
  vec2 uv=fc/iResolution.xy;
  float asp=iResolution.x/iResolution.y;
  vec2 m=mouseUv();
  vec3 sky=mix(vec3(0.35,0.55,0.9),vec3(0.75,0.85,1.0),uv.y);
  vec2 p=vec2(uv.x*asp,uv.y);
  float wind=iTime*0.02+(m.x-0.5)*0.3;
  float c=0.0,a=0.6,sc=2.0;
  for(int i=0;i<5;i++){c+=a*fbm(p*sc+vec2(wind*sc,0.0));sc*=1.9;a*=0.55;}
  c=smoothstep(0.45,0.9,c)*smoothstep(0.0,0.4,uv.y);
  vec3 cloud=mix(vec3(0.6,0.65,0.75),vec3(1.0),c);
  vec3 col=mix(sky,cloud,c);
  // sun
  vec2 s=(uv-vec2(0.75,0.8))*vec2(asp,1.0);
  col+=vec3(1.0,0.95,0.8)*exp(-length(s)*4.0)*0.6;
  o=vec4(col,1.0);
}`);

const voronoiCrystal = sh2(`
void mainImage(out vec4 o,in vec2 fc){
  vec2 uv=(fc-0.5*iResolution.xy)/iResolution.y;
  vec2 m=(mouseUv()-0.5);
  float t=iTime*0.1;
  vec2 p=uv*4.0;
  float d1=8.0,d2=8.0;vec2 pt=vec2(0.0);
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 g=floor(p)+vec2(x,y);
    vec2 c=g+0.5+0.4*sin(t+6.2831*hash22(g));
    float dd=length(p-c);
    if(dd<d1){d2=d1;d1=dd;pt=c;}else if(dd<d2)d2=dd;
  }
  vec2 toC=normalize(p-pt+1e-4);
  float facet=d2-d1;
  vec3 n=normalize(vec3(toC*facet,0.6));
  vec3 refl=reflect(vec3(0.0,0.0,-1.0),n);
  float env=refl.y*0.5+0.5;
  vec3 col=mix(vec3(0.1,0.15,0.3),vec3(0.7,0.85,1.0),env);
  col+=pow(max(dot(n,normalize(vec3(m,1.0))),0.0),30.0)*vec3(1.0);
  col+=smoothstep(0.1,0.0,facet)*0.3;
  o=vec4(col,1.0);
}`);

const sunflare = sh2(`
void mainImage(out vec4 o,in vec2 fc){
  vec2 uv=(fc-0.5*iResolution.xy)/iResolution.y;
  vec2 m=(mouseUv()-0.5)*2.0;
  vec3 col=mix(vec3(0.02,0.03,0.08),vec3(0.1,0.05,0.15),length(uv));
  vec2 sun=m;
  float d=length(uv-sun);
  col+=vec3(1.0,0.85,0.5)*exp(-d*6.0)*2.0;
  float a=atan(uv.y-sun.y,uv.x-sun.x);
  float rays=0.5+0.5*sin(a*20.0+iTime);
  col+=vec3(1.0,0.8,0.4)*rays*exp(-d*3.0)*0.4;
  // lens ghosts along the axis
  for(int i=1;i<=5;i++){float fi=float(i);
    vec2 gp=mix(sun,-sun,fi*0.22);
    float gd=length(uv-gp);
    vec3 tint=0.5+0.5*cos(vec3(0.0,2.0,4.0)+fi);
    col+=tint*smoothstep(0.12,0.0,gd)*0.25;
  }
  col+=vec3(0.6,0.7,1.0)*smoothstep(0.5,0.0,abs(dot(uv-sun,normalize(vec2(1.0,0.3)))))*exp(-d*2.0)*0.15;
  o=vec4(col,1.0);
}`);

const terrain = sh2(`
float h(vec2 p){return fbm(p*2.0)*0.5+fbm(p*6.0)*0.1;}
void mainImage(out vec4 o,in vec2 fc){
  vec2 uv=fc/iResolution.xy;
  float asp=iResolution.x/iResolution.y;
  vec2 m=mouseUv()-0.5;
  vec3 col=mix(vec3(0.9,0.6,0.4),vec3(0.3,0.4,0.7),smoothstep(0.4,1.0,uv.y));
  float found=0.0;vec3 hit=vec3(0.0);
  for(int i=0;i<60;i++){
    float fi=float(i)/60.0;
    float dist=0.1+fi*4.0;
    vec2 wp=vec2((uv.x-0.5)*asp*dist+m.x*dist*0.3, dist)+vec2(iTime*0.05,iTime*0.1);
    float terr=0.35 - dist*0.04 + h(wp)*(0.4/(1.0+dist));
    if(uv.y<terr && found<0.5){
      found=1.0;
      float shade=0.5+0.5*(h(wp+vec2(0.01,0.0))-h(wp));
      vec3 g=mix(vec3(0.2,0.3,0.15),vec3(0.5,0.6,0.4),fi);
      g=mix(g,vec3(0.9,0.95,1.0),smoothstep(0.3,0.45,terr)); // snow caps
      hit=g*(0.6+0.5*shade)*(1.0-fi*0.4);
    }
  }
  col=mix(col,hit,found);
  o=vec4(col,1.0);
}`);

const audioBars3d = sh2(`
void mainImage(out vec4 o,in vec2 fc){
  vec2 uv=fc/iResolution.xy;
  float asp=iResolution.x/iResolution.y;
  vec2 m=mouseUv();
  vec3 col=mix(vec3(0.02,0.02,0.06),vec3(0.08,0.03,0.12),uv.y);
  float n=24.0;
  float idx=floor(uv.x*n);
  float band=texture(iChannel0,vec2((idx+0.5)/n,0.5)).r;
  band=pow(band,0.8)*0.9+0.05;
  float localx=fract(uv.x*n);
  float floorY=0.5;
  float bar=step(localx,0.7)*step(abs(uv.y-floorY),band*0.5);
  vec3 c=0.5+0.5*cos(6.2831*(idx/n+vec3(0.0,0.33,0.67))+iTime*0.5);
  col+=c*bar;
  // soft reflection below the floor line + base glow
  float reflY=floorY-(uv.y-floorY); // mirror across floorY (only valid below)
  float refl=step(localx,0.7)*step(uv.y,floorY)*step(abs(reflY-floorY),band*0.5);
  col+=c*refl*smoothstep(0.0,0.5,floorY-uv.y)*0.18;
  col+=c*exp(-abs(uv.y-floorY)*4.0)*band*0.2;
  o=vec4(col,1.0);
}`);

const paperWaves = sh2(`
void mainImage(out vec4 o,in vec2 fc){
  vec2 uv=fc/iResolution.xy;
  vec2 m=mouseUv()-0.5;
  vec3 col=mix(vec3(0.96,0.93,0.86),vec3(0.85,0.88,0.92),uv.y);
  for(int i=0;i<7;i++){float fi=float(i);
    float base=0.15+fi*0.12;
    float y=base+0.05*sin(uv.x*6.0+fi*1.3+iTime*0.3)+0.02*sin(uv.x*17.0+fi)+m.y*0.03;
    float line=smoothstep(0.004,0.0,abs(uv.y-y));
    float fillBelow=smoothstep(y+0.001,y-0.001,uv.y);
    vec3 lc=0.5+0.5*cos(6.2831*(fi*0.14+vec3(0.0,0.33,0.67)));
    col=mix(col,mix(col,lc,0.12),fillBelow*0.5);
    col=mix(col,lc*0.6,line);
  }
  col*=0.97+0.03*noise(fc*0.5);
  o=vec4(col,1.0);
}`);

const emberRise = sh2(`
void mainImage(out vec4 o,in vec2 fc){
  vec2 uv=fc/iResolution.xy;
  float asp=iResolution.x/iResolution.y;
  vec2 m=mouseUv();
  vec3 col=mix(vec3(0.08,0.02,0.0),vec3(0.0),uv.y);
  for(int l=0;l<3;l++){float fl=float(l);
    vec2 p=vec2(uv.x*asp,uv.y)*(10.0+fl*8.0);
    float sp=iTime*(0.6+fl*0.4);
    p.y+=sp;
    p.x+=sin(p.y*0.5+fl)*0.4+(m.x-0.5)*2.0;
    vec2 g=floor(p),f=fract(p)-0.5;
    vec2 off=hash22(g+fl)-0.5;
    float d=length(f-off*0.6);
    float life=hash21(g+fl*3.0);
    float glow=smoothstep(0.12-fl*0.02,0.0,d)*step(0.6,life);
    vec3 ember=mix(vec3(1.0,0.5,0.1),vec3(1.0,0.9,0.4),hash21(g*1.3));
    col+=ember*glow*(1.0-fl*0.25)*(0.6+0.4*sin(iTime*3.0+life*20.0));
  }
  col+=vec3(1.0,0.4,0.1)*smoothstep(0.0,0.4,1.0-uv.y)*0.15;
  o=vec4(col,1.0);
}`);

const warpGrid = sh2(`
void mainImage(out vec4 o,in vec2 fc){
  vec2 uv=(fc-0.5*iResolution.xy)/iResolution.y;
  vec2 m=(mouseUv()-0.5);
  float t=iTime*0.3;
  float r=length(uv-m*0.5);
  // gravitational-lens style warp
  vec2 p=uv + (m*0.5-uv)*0.15/(r*r+0.1);
  vec2 g=p*8.0+vec2(t,t*0.6);
  vec2 gw=fwidth(g);
  vec2 grid=1.0-smoothstep(vec2(0.0),gw*1.5,0.5-abs(fract(g)-0.5));
  float line=max(grid.x,grid.y);
  vec3 col=vec3(0.02,0.03,0.08);
  vec3 c=0.5+0.5*cos(6.2831*(r+vec3(0.6,0.2,0.9))+t);
  col+=c*line*(0.6+bass());
  col+=c*exp(-r*3.0)*0.4;
  o=vec4(col,1.0);
}`);

const jellyfish = sh2(`
void mainImage(out vec4 o,in vec2 fc){
  vec2 uv=fc/iResolution.xy;
  float asp=iResolution.x/iResolution.y;
  vec2 m=mouseUv();
  vec3 col=mix(vec3(0.0,0.02,0.08),vec3(0.0,0.08,0.2),uv.y);
  // rising particles
  for(int i=0;i<40;i++){float fi=float(i);
    vec2 pp=vec2(hash11(fi*1.3)*asp,fract(hash11(fi*2.1)-iTime*0.03));
    float d=length(vec2((uv.x*asp-pp.x),uv.y-pp.y));
    col+=vec3(0.3,0.6,0.8)*smoothstep(0.01,0.0,d)*0.5;
  }
  for(int j=0;j<4;j++){float fj=float(j);
    vec2 c=vec2((0.25+fj*0.2)*asp+sin(iTime*0.3+fj)*0.1, 0.4+0.25*sin(iTime*0.25+fj*2.0));
    c+=(vec2(m.x*asp,m.y)-c)*0.1*exp(-length(vec2((uv.x*asp),uv.y)-c));
    vec2 d=vec2((uv.x*asp-c.x),uv.y-c.y);
    float bell=smoothstep(0.12,0.0,length(d*vec2(1.0,1.4))) * step(0.0,d.y+0.02);
    vec3 glow=0.5+0.5*cos(vec3(0.0,2.0,4.0)+fj);
    col+=glow*bell*0.7;
    // tentacles
    float tent=smoothstep(0.015,0.0,abs(d.x+sin(d.y*20.0+iTime*2.0+fj)*0.03))*step(d.y,0.0)*smoothstep(-0.3,0.0,d.y);
    col+=glow*tent*0.4;
    col+=glow*smoothstep(0.2,0.0,length(d))*0.1;
  }
  o=vec4(col,1.0);
}`);

export const SHADER_LIBRARY_V4: LibraryShader[] = [
  { id: "starfield", name: "Hyperspace", category: "space", description: "Fly through a warping starfield that steers with your mouse.", code: starfield, effects: { parallax: 0.2 } },
  { id: "matrix-globe", name: "Data Globe", category: "retro", description: "A glowing wireframe globe of streaming green code.", code: matrixGlobe },
  { id: "cells", name: "Living Cells", category: "abstract", description: "Soft cellular shapes drifting and glowing to the music.", code: cells, effects: { beatPulse: 0.3 } },
  { id: "mandala", name: "Kaleido Mandala", category: "abstract", description: "A symmetric mandala that breathes with the bass.", code: mandala, effects: { beatPulse: 0.4 } },
  { id: "fluid-ink", name: "Fluid Ink", category: "abstract", description: "Colored ink folding through water around your cursor.", code: fluidInk },
  { id: "clouds", name: "Daydream Sky", category: "nature", description: "Soft volumetric clouds drifting across a blue sky.", code: clouds, effects: { parallax: 0.25 } },
  { id: "crystal", name: "Crystal Facets", category: "abstract", description: "Shimmering crystalline facets catching the light.", code: voronoiCrystal },
  { id: "sunflare", name: "Lens Flare", category: "space", description: "A radiant sun with anamorphic lens ghosts you can move.", code: sunflare, effects: { bloom: 0.4 } },
  { id: "terrain", name: "Endless Peaks", category: "nature", description: "Procedural snow-capped mountains scrolling to the horizon.", code: terrain, effects: { parallax: 0.3 } },
  { id: "audio-bars", name: "Spectrum Stage", category: "retro", description: "A 24-band audio spectrum with glowing reflections.", code: audioBars3d, effects: { beatPulse: 0.2 } },
  { id: "paper-waves", name: "Paper Layers", category: "cozy", description: "Calm layered paper-cut waves in pastel tones.", code: paperWaves },
  { id: "embers", name: "Rising Embers", category: "cozy", description: "Warm embers floating up from a fire you can fan.", code: emberRise, effects: { bloom: 0.3 } },
  { id: "warp-grid", name: "Gravity Grid", category: "abstract", description: "A neon grid bent by a gravity well under your cursor.", code: warpGrid, effects: { beatPulse: 0.3 } },
  { id: "jellyfish", name: "Jelly Drift", category: "nature", description: "Glowing jellyfish pulsing through the deep sea.", code: jellyfish, effects: { parallax: 0.3 } },
];
