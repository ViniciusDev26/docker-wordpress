#!/usr/bin/env bun
/**
 * Script de inicialização do WordPress com posts de teste
 * Substitui o init-wordpress.sh usando Bun/TypeScript
 */

import { $ } from 'bun';

const colors = {
  yellow: '\x1b[1;33m',
  green: '\x1b[0;32m',
  red: '\x1b[0;31m',
  reset: '\x1b[0m',
};

/**
 * Executa comando WP-CLI usando sh -c para processar corretamente aspas
 */
async function wp(command: string): Promise<string> {
  const fullCommand = `wp ${command} --allow-root`;
  const proc = Bun.spawn(['sh', '-c', fullCommand], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const error = await new Response(proc.stderr).text();
    throw new Error(`WP-CLI failed: ${error}`);
  }

  return output;
}

/**
 * Executa comando MySQL
 */
async function mysql(query: string): Promise<void> {
  await $`mysql -h db -u root -proot wordpress -e ${query}`.quiet();
}

/**
 * Deleta posts de teste se existirem (evita duplicados)
 */
async function deleteTestPostsIfExist(): Promise<void> {
  const postSlugs = ['post-texto-400kb', 'post-imagem-1mb', 'post-imagem-300kb'];

  for (const slug of postSlugs) {
    try {
      const postId = await wp(`post list --name=${slug} --format=ids`);
      if (postId.trim()) {
        console.log(`Deletando post existente: ${slug}...`);
        await wp(`post delete ${postId.trim()} --force`);
      }
    } catch (error) {
      // Post não existe, continuar
    }
  }
}

/**
 * Instala o WordPress
 */
async function installWordPress(): Promise<void> {
  console.log('Instalando WordPress...');

  await $`wp core install --url="http://localhost" --title="Blog de Testes de Carga" --admin_user="admin" --admin_password="admin123" --admin_email="admin@example.com" --skip-email --allow-root`.quiet();

  // Configurar permalinks para URLs amigáveis
  console.log('Configurando estrutura de permalinks...');
  await wp('rewrite structure "/%postname%/"');

  console.log('WordPress instalado com sucesso!');
}

/**
 * Cria post com texto grande (400KB)
 */
async function createLargeTextPost(): Promise<void> {
  console.log('Criando post com texto de 400KB...');

  // Gerar texto grande (400KB)
  console.log('Gerando conteúdo de texto grande (400KB)...');

  let content = '';
  for (let i = 1; i <= 5000; i++) {
    content += `<p>Este é um parágrafo de teste número ${i}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</p>`;
  }

  // Salvar conteúdo em arquivo temporário
  const tempFile = '/tmp/large-text-content.html';
  await Bun.write(tempFile, content);

  // Criar post usando arquivo temporário
  console.log('Criando post com conteúdo grande...');
  await $`wp post create ${tempFile} --post_title="Post com Texto Grande (400KB)" --post_status=publish --post_name="post-texto-400kb" --allow-root`.quiet();

  // Limpar arquivo temporário
  await $`rm -f ${tempFile}`.quiet();
}

/**
 * Cria post com imagem de 1MB
 */
async function createPost1MB(): Promise<number> {
  console.log('Criando post com imagem de 1MB...');

  const postId = await wp('post create --post_title="Post com Imagem 1MB" --post_content="<p>Este post contém uma imagem de aproximadamente 1MB.</p>" --post_status=publish --post_name="post-imagem-1mb" --porcelain');

  return parseInt(postId.trim());
}

/**
 * Cria post com imagem de 300KB
 */
async function createPost300KB(): Promise<number> {
  console.log('Criando post com imagem de 300KB...');

  const postId = await wp('post create --post_title="Post com Imagem 300KB" --post_content="<p>Este post contém uma imagem de aproximadamente 300KB.</p>" --post_status=publish --post_name="post-imagem-300kb" --porcelain');

  return parseInt(postId.trim());
}

/**
 * Gera imagem usando ImageMagick com tamanho aproximado em KB
 */
async function generateImage(
  targetSizeKB: number,
  output: string,
  label: string,
  background: string
): Promise<void> {
  // Dimensões e qualidade ajustados para atingir tamanhos próximos
  let width: number;
  let height: number;
  let quality: number;

  if (targetSizeKB >= 1000) {
    // Para ~1MB (1024KB)
    width = 3200;
    height = 2200;
    quality = 88;
  } else if (targetSizeKB >= 300) {
    // Para ~300KB
    width = 1800;
    height = 1300;
    quality = 85;
  } else {
    // Para outros tamanhos
    width = 1000;
    height = 700;
    quality = 82;
  }

  const pointsize = targetSizeKB >= 1000 ? '120' : '80';

  // Gerar imagem com padrão plasma (gera mais dados = arquivo maior)
  await $`convert -size ${width}x${height} plasma:${background} -pointsize ${pointsize} -fill white -gravity center -annotate +0+0 ${label} -quality ${quality} ${output}`.quiet();

  // Verificar tamanho final
  const fileInfo = await Bun.file(output);
  const finalSize = Math.round(fileInfo.size / 1024);

  console.log(`${colors.green}✓ Imagem gerada: ${finalSize}KB (alvo: ${targetSizeKB}KB)${colors.reset}`);
}

/**
 * Faz upload de imagem para o WordPress usando MySQL direto
 */
async function uploadImage(
  imagePath: string,
  postId: number,
  setFeatured: boolean = true
): Promise<number> {
  // Copiar imagem para o diretório de uploads do WordPress
  const uploadDir = '/var/www/html/wp-content/uploads/2025/10';
  await $`mkdir -p ${uploadDir}`.quiet();

  const fileName = imagePath.split('/').pop();
  const destPath = `${uploadDir}/${fileName}`;
  await $`cp ${imagePath} ${destPath}`.quiet();

  // Inserir entrada no banco de dados e obter ID em uma única conexão
  const imageUrl = `http://localhost/wp-content/uploads/2025/10/${fileName}`;
  const mimeType = fileName?.endsWith('.jpg') ? 'image/jpeg' : 'image/png';

  const combinedQuery = `
    INSERT INTO wp_posts (post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt, post_status, comment_status, ping_status, post_password, post_name, to_ping, pinged, post_modified, post_modified_gmt, post_content_filtered, post_parent, guid, menu_order, post_type, post_mime_type, comment_count)
    VALUES (1, NOW(), NOW(), '', '${fileName}', '', 'inherit', 'open', 'closed', '', '${fileName}', '', '', NOW(), NOW(), '', ${postId}, '${imageUrl}', 0, 'attachment', '${mimeType}', 0);
    SELECT LAST_INSERT_ID();
  `;

  const proc = Bun.spawn(['mysql', '-h', 'db', '-u', 'root', '-proot', 'wordpress', '-e', combinedQuery, '-sN'], {
    stdout: 'pipe',
  });

  const result = await new Response(proc.stdout).text();
  await proc.exited;

  const imageId = parseInt(result.trim());

  // Definir como imagem destacada se solicitado
  if (setFeatured) {
    await mysql(`INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (${postId}, '_thumbnail_id', '${imageId}') ON DUPLICATE KEY UPDATE meta_value='${imageId}'`);
  }

  return imageId;
}

/**
 * Obtém URL da imagem usando MySQL
 */
async function getImageUrl(imageId: number): Promise<string> {
  const proc = Bun.spawn(['mysql', '-h', 'db', '-u', 'root', '-proot', 'wordpress', '-e', `SELECT guid FROM wp_posts WHERE ID = ${imageId};`, '-sN'], {
    stdout: 'pipe',
  });

  const result = await new Response(proc.stdout).text();
  await proc.exited;

  return result.trim();
}

/**
 * Atualiza conteúdo do post
 */
async function updatePostContent(postId: number, content: string): Promise<void> {
  await wp(`post update ${postId} --post_content="${content}"`);
}

/**
 * Função principal
 */
async function main() {
  try {
    // Instalar WordPress se ainda não estiver instalado
    let isNewInstall = false;
    try {
      const installed = await $`wp core is-installed --allow-root`.quiet();
      if (installed.exitCode !== 0) {
        await installWordPress();
        isNewInstall = true;
      } else {
        console.log('WordPress já está instalado.');
        // Garantir que os permalinks estão configurados
        console.log('Verificando configuração de permalinks...');
        await wp('rewrite structure "/%postname%/"');
      }
    } catch {
      await installWordPress();
      isNewInstall = true;
    }

    // Deletar posts de teste existentes para evitar duplicados
    console.log('Verificando posts existentes...');
    await deleteTestPostsIfExist();

    // Criar posts
    await createLargeTextPost();

    const post1MBId = await createPost1MB();
    const post300KBId = await createPost300KB();

    // Gerar imagens
    console.log('Gerando imagem de 1MB...');
    await generateImage(1024, '/tmp/image-1mb.jpg', 'Imagem\\n1MB', '#FF6B6B');

    console.log('Gerando imagem de 300KB...');
    await generateImage(300, '/tmp/image-300kb.jpg', 'Imagem\\n300KB', '#4ECDC4');

    // Upload das imagens
    console.log('Fazendo upload da imagem de 1MB...');
    const image1MBId = await uploadImage('/tmp/image-1mb.jpg', post1MBId, true);

    console.log('Fazendo upload da imagem de 300KB...');
    const image300KBId = await uploadImage('/tmp/image-300kb.jpg', post300KBId, true);

    // Atualizar posts com as imagens
    console.log('Atualizando posts com as imagens...');

    const image1MBUrl = await getImageUrl(image1MBId);
    const image300KBUrl = await getImageUrl(image300KBId);

    await updatePostContent(
      post1MBId,
      `<p>Este post contém uma imagem de aproximadamente 1MB.</p><img src='${image1MBUrl}' alt='Imagem 1MB' />`
    );

    await updatePostContent(
      post300KBId,
      `<p>Este post contém uma imagem de aproximadamente 300KB.</p><img src='${image300KBUrl}' alt='Imagem 300KB' />`
    );

    // Mensagem de sucesso
    console.log('==========================================');
    console.log('WordPress configurado com sucesso!');
    console.log('==========================================');
    console.log('URL: http://localhost');
    console.log('Usuário: admin');
    console.log('Senha: admin123');
    console.log('==========================================');
    console.log('Posts criados:');
    console.log('1. /post-texto-400kb/ - Post com texto de 400KB');
    console.log('2. /post-imagem-1mb/ - Post com imagem de 1MB');
    console.log('3. /post-imagem-300kb/ - Post com imagem de 300KB');
    console.log('==========================================');

  } catch (error) {
    console.error(`${colors.red}Erro durante a inicialização:${colors.reset}`, error);
    process.exit(1);
  }
}

// Executar
main();
