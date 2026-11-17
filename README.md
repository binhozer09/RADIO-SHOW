# RADIO SHOW

Aplicativo Android/PWA para ouvir a transmissão independente da RADIO SHOW.

## Arquitetura da rádio na nuvem

O repositório agora inclui um servidor Icecast + FFmpeg em `stream-server/`. Ele executa uma playlist de arquivos de áudio em loop no servidor, sem depender do celular do proprietário nem de um player do YouTube.

- Endpoint de áudio: `/radio.mp3`
- Página de estado: `/status-json.xsl`
- Pasta persistente de músicas no servidor: `/music`
- Formatos aceitos: MP3, M4A, AAC, WAV, OGG e FLAC.
- O codificador reinicia automaticamente se o processo de transmissão cair.
- O servidor inclui somente faixas com duração de até 5 minutos; arquivos maiores são ignorados.
- A playlist é repetida continuamente enquanto houver faixas na pasta.

## O que falta para entrar no ar

1. Conectar uma hospedagem de contêiner sempre ativa (o projeto está preparado para Railway).
2. Criar um volume persistente montado em `/music`.
3. Configurar as variáveis secretas `ICECAST_SOURCE_PASSWORD` e `ICECAST_ADMIN_PASSWORD`. Não coloque senhas no GitHub.
4. Enviar para `/music` arquivos de áudio que você tenha direito de transmitir.
5. Gerar o domínio HTTPS público do serviço e preencher `streamUrl` em `radio-config.json` com o endereço completo terminado em `/radio.mp3`.
6. Copiar o mesmo `radio-config.json` para `app/src/main/assets/radio-config.json` antes de compilar o APK.

**Importante:** o servidor não extrai nem retransmite vídeos do YouTube. É necessário usar arquivos de áudio próprios ou licenciados para retransmissão. O serviço de nuvem precisa permanecer ativo e pode ter custo conforme o provedor e o tráfego. O ouvinte ainda precisa de internet e de um dispositivo ligado para escutar.

## Desenvolvimento local

Para testar o servidor com Docker Compose, crie um arquivo `.env` local com as senhas (não o envie ao GitHub), monte sua pasta de músicas em `/music` e execute `docker compose up --build`.

O app usa `radio-config.json` para saber qual URL de streaming reproduzir. Com `streamUrl` vazio, os botões mostram que a transmissão ainda não foi ativada.
