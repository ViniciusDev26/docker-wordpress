# Docker WordPress com Load Balancer

Este projeto configura um ambiente WordPress escalável usando Docker Compose com múltiplas instâncias e um load balancer Nginx.

## Arquitetura

O projeto é composto por três serviços principais:

- **WordPress**: Múltiplas instâncias do WordPress (PHP 7.4 + Apache)
- **MySQL**: Banco de dados para o WordPress
- **Nginx**: Load balancer que distribui requisições entre as instâncias do WordPress

## Inicialização

Para iniciar o projeto com 5 instâncias do WordPress, execute:

```bash
docker compose up -d --scale wordpress=5
```

O comando acima irá:
- Iniciar o banco de dados MySQL
- Criar 5 instâncias do WordPress
- Iniciar o Nginx como load balancer na porta 80

## Acesso

Após a inicialização, acesse o WordPress através de:

```
http://localhost
```

O Nginx irá distribuir automaticamente as requisições entre as 5 instâncias do WordPress.

## Configuração

- **Porta**: 80
- **Banco de dados**: MySQL (usuário: root, senha: root)
- **Volumes**: Os arquivos do WordPress são armazenados em `./wp-content`
