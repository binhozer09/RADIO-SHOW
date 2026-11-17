# RADIO SHOW

Aplicativo Android para acompanhar a programação sincronizada do canal oficial Robinho Show.

## Arquitetura atual

- O app usa o **YouTube IFrame Player API oficial**. Os vídeos são reproduzidos nos dispositivos dos ouvintes diretamente pelo YouTube.
- O servidor Node.js em `stream-server/` roda na Railway e controla um relógio global da programação.
- O backend consulta os envios públicos do canal `@RobinhoShowOficial`, verifica a duração e inclui apenas vídeos de até **300 segundos** que permitem incorporação.
- A sequência e o horário de início ficam persistidos como pequenos metadados JSON em `/music/schedule.json`; nenhum vídeo, áudio ou MP3 é baixado ou armazenado.
- Cada app consulta `/api/now-playing` a cada 12 segundos e ajusta o vídeo/posição para acompanhar o mesmo ponto da programação.
- O servidor continua calculando a programação mesmo sem nenhum celular conectado. Para ouvir, cada aparelho precisa estar ligado, conectado e com o app aberto; o Android/YouTube pode exigir o primeiro toque para iniciar a reprodução.

## Configuração obrigatória na Railway

No serviço `RADIO-SHOW-STREAM`, configure:

- `YOUTUBE_API_KEY`: chave da YouTube Data API v3 (guardar somente como variável secreta na Railway).
- `YOUTUBE_CHANNEL_HANDLE`: `RobinhoShowOficial` (já existe esse padrão no código).
- `MAX_DURATION_SECONDS`: `300` (padrão já aplicado).
- `STATE_FILE`: `/music/schedule.json` (padrão; usa o volume persistente já montado em `/music`).

Ative a YouTube Data API v3 no Google Cloud e crie uma chave de API com restrição para a YouTube Data API v3. Não publique a chave no GitHub, no APK ou neste chat.

## Endpoints

- `GET /health`: saúde do processo e confirmação se a chave foi configurada.
- `GET /api/now-playing`: vídeo atual, duração, posição, índice da fila, ciclo e horário do servidor.

## Limites importantes

- A sincronização é feita pelo relógio da nuvem; pequenas diferenças de buffer/rede e bloqueios do player podem causar alguns segundos de variação.
- A programação não reproduz áudio no servidor. O servidor agenda metadados; o YouTube entrega o vídeo a cada ouvinte.
- Fechar o app ou desligar o aparelho interrompe a reprodução naquele aparelho. O relógio da rádio na nuvem continua.
- O YouTube decide como contabiliza visualizações; não há geração artificial de views nem garantia de contagem.
- Somente vídeos públicos, incorporáveis e com duração de até 5 minutos entram na fila. Se o canal não tiver vídeos elegíveis, a API informa o motivo.

## Build Android

O workflow `.github/workflows/build-apk.yml` compila o APK de depuração em cada push na branch `main`.
