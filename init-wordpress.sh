#!/bin/bash
# Script de inicialização do WordPress com posts de teste

echo "Aguardando WordPress estar pronto..."
sleep 30

echo "Instalando WordPress..."
wp core install \
  --url="http://localhost" \
  --title="Blog de Testes de Carga" \
  --admin_user="admin" \
  --admin_password="admin123" \
  --admin_email="admin@example.com" \
  --skip-email \
  --allow-root

echo "WordPress instalado com sucesso!"

# Gerar texto grande (400KB)
echo "Gerando conteúdo de texto grande (400KB)..."
LARGE_TEXT=""
for i in {1..5000}; do
  LARGE_TEXT="${LARGE_TEXT}Este é um parágrafo de teste número ${i}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. "
done

# Criar post com texto de 400KB
echo "Criando post com texto de 400KB..."
wp post create \
  --post_title="Post com Texto Grande (400KB)" \
  --post_content="$LARGE_TEXT" \
  --post_status=publish \
  --post_name="post-texto-400kb" \
  --allow-root

# Criar post para imagem de 1MB
echo "Criando post com imagem de 1MB..."
POST_1MB_ID=$(wp post create \
  --post_title="Post com Imagem 1MB" \
  --post_content="<p>Este post contém uma imagem de aproximadamente 1MB.</p>" \
  --post_status=publish \
  --post_name="post-imagem-1mb" \
  --porcelain \
  --allow-root)

# Criar post para imagem de 300KB
echo "Criando post com imagem de 300KB..."
POST_300KB_ID=$(wp post create \
  --post_title="Post com Imagem 300KB" \
  --post_content="<p>Este post contém uma imagem de aproximadamente 300KB.</p>" \
  --post_status=publish \
  --post_name="post-imagem-300kb" \
  --porcelain \
  --allow-root)

# Criar imagem de 1MB (1000x1000 pixels)
echo "Gerando imagem de 1MB..."
convert -size 1000x1000 \
  -background "#FF6B6B" \
  -fill white \
  -pointsize 72 \
  -gravity center \
  label:"Imagem\n1MB" \
  -quality 85 \
  /tmp/image-1mb.jpg

# Criar imagem de 300KB (600x600 pixels)
echo "Gerando imagem de 300KB..."
convert -size 600x600 \
  -background "#4ECDC4" \
  -fill white \
  -pointsize 48 \
  -gravity center \
  label:"Imagem\n300KB" \
  -quality 85 \
  /tmp/image-300kb.jpg

# Fazer upload da imagem de 1MB
echo "Fazendo upload da imagem de 1MB..."
IMAGE_1MB_ID=$(wp media import /tmp/image-1mb.jpg \
  --post_id=$POST_1MB_ID \
  --featured_image \
  --porcelain \
  --allow-root)

# Fazer upload da imagem de 300KB
echo "Fazendo upload da imagem de 300KB..."
IMAGE_300KB_ID=$(wp media import /tmp/image-300kb.jpg \
  --post_id=$POST_300KB_ID \
  --featured_image \
  --porcelain \
  --allow-root)

# Adicionar imagens ao conteúdo dos posts
echo "Atualizando posts com as imagens..."
IMAGE_1MB_URL=$(wp post get $IMAGE_1MB_ID --field=guid --allow-root)
IMAGE_300KB_URL=$(wp post get $IMAGE_300KB_ID --field=guid --allow-root)

wp post update $POST_1MB_ID \
  --post_content="<p>Este post contém uma imagem de aproximadamente 1MB.</p><img src='$IMAGE_1MB_URL' alt='Imagem 1MB' />" \
  --allow-root

wp post update $POST_300KB_ID \
  --post_content="<p>Este post contém uma imagem de aproximadamente 300KB.</p><img src='$IMAGE_300KB_URL' alt='Imagem 300KB' />" \
  --allow-root

echo "=========================================="
echo "WordPress configurado com sucesso!"
echo "=========================================="
echo "URL: http://localhost"
echo "Usuário: admin"
echo "Senha: admin123"
echo "=========================================="
echo "Posts criados:"
echo "1. /post-imagem-1mb/ - Post com imagem de 1MB"
echo "2. /post-texto-400kb/ - Post com texto de 400KB"
echo "3. /post-imagem-300kb/ - Post com imagem de 300KB"
echo "=========================================="

# Manter o container rodando
tail -f /dev/null