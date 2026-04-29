# GPS Real-Time Fleet Tracker

Sistema de rastreamento GPS profissional para equipes de campo.

## 🚀 Como fazer o Deploy (Passo a Passo)

### 1. Criar Repositório no GitHub
1. Vá para [github.com/new](https://github.com/new).
2. Nomeie o repositório como `gps-tracker`.
3. **Não** inicialize com README ou .gitignore (já criamos os arquivos locais).
4. Clique em "Create repository".

### 2. Subir o Código para o GitHub
Abra o terminal na pasta do projeto e execute:
```bash
git init
git add .
git commit -m "Initial production commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/gps-tracker.git
git push -u origin main
```
*(Substitua `SEU_USUARIO` pelo seu nome de usuário no GitHub)*

### 3. Deploy no EasyPanel
1. No seu painel **EasyPanel**, clique em **Create Project**.
2. Dentro do projeto, clique em **Create Service** -> **App**.
3. Em **Source**, escolha **Git Repository**.
4. Cole a URL do seu repositório GitHub.
5. Em **Build**, o EasyPanel deve detectar automaticamente o `Dockerfile` que eu criei.
6. Em **Environment**, você não precisa mudar nada por enquanto.
7. Em **Network**, certifique-se de que a porta interna é **3000**.
8. Clique em **Deploy**.

### 4. Configurar o App Mobile (IMPORTANTE)
Assim que o deploy terminar, o EasyPanel vai te dar uma URL (ex: `https://gps.dominio.com`).
1. Abra o arquivo `mobile_app/lib/main.dart`.
2. Altere a linha:
   ```dart
   final String serverUrl = "http://192.168.1.32:3000";
   ```
   para a sua nova URL:
   ```dart
   final String serverUrl = "https://gps.dominio.com";
   ```
3. Gere o APK final:
   ```powershell
   flutter build apk --release
   ```
4. Distribua este novo APK para os técnicos.

## 📡 Funcionamento (WiFi e 4G)
*   **Servidor:** Rodando na nuvem (EasyPanel), ele estará acessível de qualquer lugar com internet.
*   **App:** Enviará as coordenadas via 4G ou WiFi para a URL pública.
*   **Dashboard:** Pode ser acessado via navegador em qualquer dispositivo usando a mesma URL.

---
**Desenvolvido com Antigravity.**
