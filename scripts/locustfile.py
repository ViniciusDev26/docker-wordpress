from locust import HttpUser, task, between


class WordPressUser(HttpUser):
    """
    Simula usuários acessando os 3 cenários de teste do WordPress:
    - Post com imagem de ~1MB
    - Post com texto de ~400KB
    - Post com imagem de ~300KB

    Testa com 3 cargas de usuários: 10, 100, 1000
    Testa com 3 arquiteturas: 1, 2, 3 instâncias do WordPress
    """

    # Tempo de espera entre requisições (1 a 2 segundos)
    wait_time = between(1, 2)

    @task(1)
    def view_post_image_1mb(self):
        """Cenário 1: Post com imagem de 1MB"""
        self.client.get("/post-imagem-1mb/")

    @task(1)
    def view_post_text_400kb(self):
        """Cenário 2: Post com texto de 400KB"""
        self.client.get("/post-texto-400kb/")

    @task(1)
    def view_post_image_300kb(self):
        """Cenário 3: Post com imagem de 300KB"""
        self.client.get("/post-imagem-300kb/")
