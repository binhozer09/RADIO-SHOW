"use strict";
// Remote-only build: all radio playback and playlist endpoints have been removed.
const http=require("node:http"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),{spawn,execFileSync}=require("node:child_process");
const PORT=Number(process.env.PORT||8000),PASSWORD=process.env.REMOTE_CONTROL_PASSWORD||"",NOVNC="/usr/share/novnc",TTL=12*60*60*1000,sessions=new Map();
function json(res,status,data){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});res.end(JSON.stringify(data));}
function html(res,file){res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","content-security-policy":"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss:; img-src 'self' data:; font-src 'self' data:"});fs.createReadStream(path.join(__dirname,file)).pipe(res);}
function equal(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function body(req){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>4096){reject(Error("Payload muito grande"));req.destroy();}});req.on("end",()=>{try{resolve(JSON.parse(raw||"{}"));}catch{reject(Error("JSON inválido"));}});req.on("error",reject);});}
function validSession(token){const s=sessions.get(token);if(!s)return false;if(s.expiresAt<Date.now()){sessions.delete(token);return false;}return true;}
function startLinux(){
 if(!PASSWORD){console.error("Defina REMOTE_CONTROL_PASSWORD no Railway para habilitar o Linux remoto.");return;}
 try{
  execFileSync("x11vnc",["-storepasswd",PASSWORD.slice(0,8),"/tmp/vnc.pass"],{stdio:"ignore"});
  const xvfb=spawn("Xvfb",[":99","-screen","0","1440x900x24","-ac","-nolisten","tcp"],{stdio:"ignore"});xvfb.on("exit",c=>console.error("Xvfb saiu:",c));
  process.env.DISPLAY=":99";
  const wait=()=>{if(!fs.existsSync("/tmp/.X11-unix/X99"))return setTimeout(wait,200);
   const wm=spawn("openbox",[],{env:process.env,stdio:"ignore"});wm.on("exit",c=>console.error("Openbox saiu:",c));
   const term=spawn("xterm",["-geometry","150x42+12+12","-fa","Monospace","-fs","12","-bg","#101018","-fg","#e8e8f0","-T","Linux remoto - RADIO SHOW","-e","bash","-l"],{env:{...process.env,DISPLAY:":99",TERM:"xterm-256color"},stdio:"ignore"});term.on("exit",c=>console.error("Terminal saiu:",c));
   const vnc=spawn("x11vnc",["-display",":99","-rfbauth","/tmp/vnc.pass","-forever","-shared","-repeat","-rfbport","5900","-localhost","-noxdamage"],{stdio:"ignore"});vnc.on("exit",c=>console.error("x11vnc saiu:",c));
   const ws=spawn("websockify",["127.0.0.1:6080","127.0.0.1:5900"],{stdio:"ignore"});ws.on("exit",c=>console.error("websockify saiu:",c));
   console.log("Linux remoto iniciado: Xvfb, Openbox, Bash e VNC.");
  };wait();
 }catch(e){console.error("Falha ao iniciar Linux:",e.message);}
}
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,"http://"+(req.headers.host||"localhost"));
 if(req.method==="GET"&&u.pathname==="/health")return json(res,200,{ok:true,service:"Linux remoto",desktop:!!PASSWORD,terminal:!!PASSWORD,display:"1440x900",sessionTtlHours:12});
 if(req.method==="GET"&&u.pathname==="/")return html(res,"index.html");
 if(req.method==="GET"&&u.pathname==="/remote/")return html(res,"remote.html");
 if(req.method==="GET"&&(u.pathname.startsWith("/remote/core/")||u.pathname.startsWith("/remote/vendor/")))return serveNoVnc(res,u.pathname.slice("/remote/".length));
 if(req.method==="GET"&&u.pathname==="/api/remote-status")return json(res,200,{enabled:!!PASSWORD,message:PASSWORD?"Linux remoto pronto.":"Configure REMOTE_CONTROL_PASSWORD no Railway."});
 if(req.method==="POST"&&u.pathname==="/api/remote-login"){
  if(!PASSWORD)return json(res,503,{error:"A senha do terminal ainda não foi configurada no Railway."});
  try{const b=await body(req);if(!equal(b.password||"",PASSWORD))return json(res,401,{error:"Senha incorreta."});
   const token=crypto.randomBytes(32).toString("hex");sessions.set(token,{expiresAt:Date.now()+TTL});
   return json(res,200,{ok:true,token,vncPassword:PASSWORD.slice(0,8),expiresInSeconds:TTL/1000});
  }catch(e){return json(res,400,{error:e.message});}
 }
 return json(res,404,{error:"Not found"});
});
function serveNoVnc(res,relative){
 const file=path.resolve(NOVNC,relative);if(!file.startsWith(NOVNC+path.sep))return json(res,403,{error:"Forbidden"});
 const types={".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".svg":"image/svg+xml",".woff":"font/woff",".woff2":"font/woff2",".ttf":"font/ttf"};
 const s=fs.createReadStream(file);s.on("open",()=>{res.writeHead(200,{"content-type":types[path.extname(file).toLowerCase()]||"application/octet-stream","cache-control":"public, max-age=3600","x-content-type-options":"nosniff"});s.pipe(res);});s.on("error",()=>json(res,404,{error:"Arquivo noVNC não encontrado."}));
}
server.on("upgrade",(req,socket,head)=>{
 const u=new URL(req.url,"http://localhost"),token=u.searchParams.get("token")||"";
 if(u.pathname!=="/websockify"||!validSession(token)){socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");socket.destroy();return;}
 const upstream=require("node:net").connect(6080,"127.0.0.1",()=>{
  const headers=["GET /websockify HTTP/1.1","Host: 127.0.0.1:6080","Upgrade: websocket","Connection: Upgrade","Sec-WebSocket-Key: "+(req.headers["sec-websocket-key"]||""),"Sec-WebSocket-Version: "+(req.headers["sec-websocket-version"]||"13"),"Origin: "+(req.headers.origin||"https://localhost"),"\r\n"].join("\r\n");
  upstream.write(headers);if(head?.length)upstream.write(head);socket.pipe(upstream).pipe(socket);
 });upstream.on("error",()=>socket.destroy());socket.on("error",()=>upstream.destroy());
});
server.listen(PORT,"0.0.0.0",()=>{console.log("Servidor Linux remoto online na porta",PORT);startLinux();});
process.on("SIGTERM",()=>server.close(()=>process.exit(0)));
