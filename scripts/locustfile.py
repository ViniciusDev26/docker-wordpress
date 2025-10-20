from locust import HttpUser, task, between


class WordPressUser(HttpUser):
    """
    Simula usuários acessando blog posts específicos no WordPress:
    - Post com imagem de ~1MB
    - Post com texto de ~400KB
    - Post com imagem de ~300KB
    """

    # Tempo de espera entre requisições (1 a 3 segundos)
    wait_time = between(1, 3)

    @task(3)
    def view_post_large_image(self):
        """
        Acessa o post com imagem de 1MB
        Peso 3: tarefa comum
        """
        self.client.get("/post-imagem-1mb/", name="Post com Imagem 1MB")

    @task(3)
    def view_post_large_text(self):
        """
        Acessa o post com texto de 400KB
        Peso 3: tarefa comum
        """
        self.client.get("/post-texto-400kb/", name="Post com Texto 400KB")

    @task(3)
    def view_post_medium_image(self):
        """
        Acessa o post com imagem de 300KB
        Peso 3: tarefa comum
        """
        self.client.get("/post-imagem-300kb/", name="Post com Imagem 300KB")

    @task(2)
    def view_homepage(self):
        """
        Acessa a página inicial
        Peso 2: menos comum
        """
        self.client.get("/", name="Homepage")

    @task(1)
    def view_all_posts_sequence(self):
        """
        Acessa os 3 posts em sequência (simula navegação real)
        Peso 1: menos frequente
        """
        posts = [
            ("/post-imagem-1mb/", "Sequência: Post 1MB"),
            ("/post-texto-400kb/", "Sequência: Post 400KB"),
            ("/post-imagem-300kb/", "Sequência: Post 300KB"),
        ]
        for url, name in posts:
            self.client.get(url, name=name)


class WordPressHeavyUser(HttpUser):
    """
    Simula usuários mais intensivos que fazem múltiplas requisições
    Útil para testes de carga mais pesados
    """

    wait_time = between(0.5, 1.5)

    @task(5)
    def rapid_post_access(self):
        """
        Acessa os posts rapidamente sem pausas longas
        Peso 5: comportamento principal
        """
        posts = ["/post-imagem-1mb/", "/post-texto-400kb/", "/post-imagem-300kb/"]
        for post_url in posts:
            self.client.get(post_url, name=f"Heavy: {post_url}")

    @task(2)
    def load_homepage_and_posts(self):
        """
        Carrega homepage e depois os posts
        Peso 2: comportamento moderado
        """
        self.client.get("/", name="Heavy: Homepage")
        self.client.get("/post-imagem-1mb/", name="Heavy: Post 1MB")
        self.client.get("/post-texto-400kb/", name="Heavy: Post 400KB")
        self.client.get("/post-imagem-300kb/", name="Heavy: Post 300KB")
