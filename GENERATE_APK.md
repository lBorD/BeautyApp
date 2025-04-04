# ** Gerar um APK a partir de AAB - BeautyApp**

### **Pré-requisitos**

- **EAS CLI** instalado.
- **Java SDK24** e **BundleTool 1.18.1** configurados.
- **Keystore** do BeautyApp (disponível no Google Drive).

---

### **Passos Essenciais**

#### **1. Gerar o AAB**

1. No terminal do projeto **BeautyApp**, execute:
   ```bash
   npm run build:android
   ```
2. O **AAB** será gerado e ficará disponível no painel **[Expo.dev](https://expo.dev)**.

#### **2. Gerar o `.apks` com o BundleTool**

1. **Baixe o keystore** do BeautyApp do Google Drive (as credenciais estarão em um txt separado).
2. Execute o comando no terminal:
   ```bash
   java -jar bundletool-all-1.18.1.jar build-apks ^
     --bundle=beautyapp.aab ^
     --output=beautyapp.apks ^
     --ks=beautyapp.keystore.jks ^
     --ks-key-alias=beautyapp-key-alias ^
     --ks-pass=pass:beautyapp-keystore-password ^
     --key-pass=pass:beautyapp-key-password ^
     --mode=universal
   ```

#### **3. Renomear e Extrair o `.apks`**

1. **Renomeie** o arquivo `.apks` para `.zip`.
2. **Extraia o conteúdo** e localize o **`universal.apk`**.

#### **4. Instalar o APK Universal**

1. **Instale o APK** no dispositivo ou emulador com:
   ```bash
   adb install beautyapp/universal/universal.apk
   ```

---
