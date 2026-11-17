# Linux Remoto — RADIO SHOW

O projeto agora tem uma única finalidade: abrir um desktop Linux hospedado na Railway dentro do aplicativo Android.

## Recursos
- Tela de autenticação no app.
- Desktop Linux transmitido por VNC via WebSocket seguro.
- Terminal Bash aberto automaticamente.
- Digitação pelo teclado do Android.
- A sessão executa no container Linux da Railway, não no celular.

## Arquitetura
- Android WebView: interface do aplicativo.
- Railway: container Linux com Xvfb, Openbox, xterm e Bash.
- noVNC + websockify: transmite a tela e os comandos de toque/teclado.
- x11vnc: compartilha a sessão gráfica virtual.
- O volume persistente existente permanece montado em /music; nenhum volume é apagado.

## Configuração obrigatória
No serviço RADIO-SHOW-STREAM, configure a variável secreta REMOTE_CONTROL_PASSWORD com uma senha forte (mínimo recomendado: 20 caracteres). O servidor usa os primeiros oito caracteres somente na autenticação interna do VNC; o login do aplicativo valida a senha completa por HTTPS e cria um token temporário para a conexão WSS.

## Rotas
- /: tela de login.
- /api/remote-status: estado do serviço.
- POST /api/remote-login: autenticação e token temporário.
- /remote/: desktop Linux.
- /health: saúde do container.

## APK
O workflow .github/workflows/build-apk.yml compila o APK de depuração a cada push na branch main.
