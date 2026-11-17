# RADIO SHOW

Aplicativo web instalável (PWA) para a rádio de Robinho Show.

## Estado atual
- Interface inicial com PLAY e PAUSE.
- Identidade visual RADIO SHOW.
- Manifesto PWA e cache básico para abrir a interface quando offline.
- Integração preparada para o player oficial do YouTube.

## Falta configurar a playlist
No arquivo `index.html`, preencha `YOUTUBE_PLAYLIST_ID` com o ID de uma playlist pública do canal oficial contendo somente vídeos de até 5 minutos.

Canal: https://www.youtube.com/@RobinhoShowOficial

A playlist deve ser revisada para excluir vídeos acima de 5 minutos. O app ainda não possui uma lista de faixas validada; não inventamos IDs nem durações.

## Limite importante
O player oficial do YouTube toca no dispositivo de cada ouvinte. Hospedar o site na nuvem mantém o aplicativo disponível, mas não transforma o YouTube em uma transmissão de áudio centralizada 24 horas. A reprodução pode parar se o app for fechado, se o sistema suspender o navegador ou conforme as regras/autoplay do YouTube. Para rádio 24/7 realmente transmitida pela nuvem, é necessário ter arquivos de áudio autorizados e um serviço de streaming próprio/licenciado.

## Publicação
Pode ser hospedado como site estático (por exemplo, GitHub Pages ou Vercel). HTTPS é necessário para instalação PWA e service worker.