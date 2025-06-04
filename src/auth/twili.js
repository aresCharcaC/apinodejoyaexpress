require('dotenv').config(); // Cargar variables de entorno
const cors = require('cors');

const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');

const app = express();
const port =3000;

// Middleware para parsear el cuerpo de la solicitud (necesario para Twilio webhooks)
app.use(cors({origin: '*'}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Configuración de Twilio
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = new twilio(accountSid, authToken);
const twilioWhatsAppSandboxNumber = process.env.TWILIO_WHATSAPP_SANDBOX_NUMBER;

// ---- Base de datos en memoria para OTPs (SOLO PARA DESARROLLO) ----
// En producción, usa Redis, MongoDB, PostgreSQL, etc.
const otpStore = {}; // { phoneNumber: { code: '123456', expiresAt: Date } }

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // OTP de 6 dígitos
}

app.get('/', (req, res)=>{
    res.send("<h1>Hola como estas</h1>")
})

// Endpoint para recibir Webhooks de Twilio (cuando el usuario te escribe)
app.post('/whatsapp/inbound', async (req, res) => {
    const incomingMessage = req.body.Body; // El contenido del mensaje del usuario
    const fromNumber = req.body.From;     // El número de WhatsApp del usuario (ej. 'whatsapp:+51912345678')

    console.log(`Mensaje recibido de <span class="math-inline">\{fromNumber\}\: "</span>{incomingMessage}"`);

    

    // Lógica para detectar solicitud de código (puedes hacerla más sofisticada)
    if (incomingMessage && incomingMessage.toLowerCase().includes('quiero mi codigo')) {
        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + parseInt(process.env.OTP_EXPIRATION_MINUTES) * 60 * 1000);

        otpStore[fromNumber] = { code: otp, expiresAt: expiresAt }; // Guarda el OTP

        try {
            await twilioClient.messages.create({
                from: twilioWhatsAppSandboxNumber, // TU número de Twilio (remitente)
                to: fromNumber,                   // El número del usuario (destinatario)
                body: `¡Hola! Tu código de verificación es: ${otp}. Válido por ${process.env.OTP_EXPIRATION_MINUTES} minutos.`
            });
            console.log(`OTP enviado a ${fromNumber}`);
        } catch (error) {
            console.error(`Error al enviar OTP a ${fromNumber}:`, error);
        }
    } else {
        // Si el mensaje no es una solicitud de código, podrías enviar una respuesta genérica
        try {
            await twilioClient.messages.create({
                from: twilioWhatsAppSandboxNumber,
                to: fromNumber,
                body: `Hola, recibí tu mensaje. Para obtener un código, por favor escribe "Quiero mi codigo".`
            });
        } catch (error) {
            console.error(`Error al responder a ${fromNumber}:`, error);
        }
    }
});

// Endpoint para que Flutter valide el código (ejemplo)
app.post('/api/validate-otp', (req, res) => {
    const { phoneNumber, otpCode } = req.body;
    console.log(`Validando OTP para el número: ${phoneNumber}, código: ${otpCode}`);
    console.log("Este el lunero que se recivio", phoneNumber)
    const storedOtp = otpStore[phoneNumber];
    console.log(`OTP almacenado: ${storedOtp}`);

    if (!storedOtp) {
        return res.status(400).json({ success: false, message: 'No hay código OTP generado para este número.' });
    }

    if (new Date() > storedOtp.expiresAt) {
        delete otpStore[phoneNumber];
        return res.status(400).json({ success: false, message: 'El código OTP ha expirado.' });
    }

    if (otpCode === storedOtp.code) {
        delete otpStore[phoneNumber];
        return res.status(200).json({ success: true, message: 'Código OTP validado correctamente.' });
    } else {
        return res.status(400).json({ success: false, message: 'Código OTP incorrecto.' });
    }
});
app.listen(port, () => {
    console.log(`Servidor Node.js escuchando en http://localhost:${port}`);
});