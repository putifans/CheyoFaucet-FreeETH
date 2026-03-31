require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.set('view engine', 'ejs');

// Variables de entorno
const {
    FAUCETPAY_API_KEY,
    HCAPTCHA_SECRET,
    HCAPTCHA_SITEKEY,
    REWARD_AMOUNT,
    CURRENCY,
    PORT = 3000
} = process.env;

app.get('/', (req, res) => {
    let claims = req.cookies.claims_count ? parseInt(req.cookies.claims_count) : 0;
    res.render('index', { 
        claims: claims, 
        sitekey: HCAPTCHA_SITEKEY,
        reward: REWARD_AMOUNT,
        currency: CURRENCY
    });
});

app.post('/claim', async (req, res) => {
    const { email, 'h-captcha-response': hCaptchaResponse } = req.body;
    let claims = req.cookies.claims_count ? parseInt(req.cookies.claims_count) : 0;

    if (claims >= 25) {
        return res.status(403).send("Has alcanzado el límite diario de 25 reclamos.");
    }

    try {
        // 1. Verificar hCaptcha
        const verify = await axios.post(`https://hcaptcha.com/siteverify`, null, {
            params: {
                secret: HCAPTCHA_SECRET,
                response: hCaptchaResponse
            }
        });

        if (!verify.data.success) return res.status(400).send("Error en el Captcha.");

        // 2. Enviar pago a FaucetPay
        const response = await axios.post('https://faucetpay.io/api/v1/send', {
            api_key: FAUCETPAY_API_KEY,
            amount: REWARD_AMOUNT,
            currency: CURRENCY,
            to: email,
            referral: false
        });

        if (response.data.status === 200) {
            // 3. Actualizar contador (24h)
            res.cookie('claims_count', claims + 1, { maxAge: 86400000, httpOnly: true });
            res.redirect('/');
        } else {
            res.status(400).send("Error de FaucetPay: " + response.data.message);
        }

    } catch (error) {
        console.error("Error en la transacción:", error.message);
        res.status(500).send("Error al procesar el pago.");
    }
});

app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));