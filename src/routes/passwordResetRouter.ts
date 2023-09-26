import express from 'express';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { prisma } from '../../prisma';


const router = express.Router();

router.post('/password-reset-link', async (req, res) => {
  const { email } = req.body;
  // todo: write your code here
  // 1. verify if email is in database
  const user = await prisma.user.findUnique({
    where: {
      email: email,
    },
  });
  if (!user) {
    res.status(404).send({ error: "Couldn't find this email." });
    return;
  }

  const timestamp = Date.now();
  const currentDate = new Date(timestamp);

  console.log(email, currentDate.toLocaleString());

  const token = crypto.randomBytes(20).toString('hex');
  const resetLink = process.env.FRONTEND_URL + `password-reset/${token}`;
  // Validate the email (make sure it's registered, etc.)

  // Create a reset token and expiry date for the user
  await prisma.user.update({
    where: { email: user.email },
    data: {
      resetToken: token,
      resetTokenExpiry: Date.now() + 3600000, // 1 hour from now
    },
  });

  // Create a transporter object using the default SMTP transport
  const transporter = nodemailer.createTransport({
    service: 'gmail', // Use your preferred email service
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // Email content
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset',
    text: `Click the link below to reset your password:\n\n${resetLink}\n\nIf you did not request a password reset, please ignore this email.`
    // You'd typically generate a unique link for the user to reset their password
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send({ message: 'Reset email sent successfully.' });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).send({ error: 'Failed to send reset email.' });
  }
});


router.post('/password-reset/confirm', async (req, res) => {

  const { token, password } = req.body;
  console.log(token)
  if (!token) {
    console.log("No token")
    res.status(401).send({ error: "Please provide a token." });
    return;
  }
  const user = await prisma.user.findUnique({
    where: {
      resetToken: token,
    }
  });
  if (!user) {
    console.log("Sad!")
    res.status(404).send({ error: "Couldn't find this user." });
    return;
  }


  if (!user.resetTokenExpiry || user.resetTokenExpiry < Date.now()) {
    console.log(`token: ${token}`)
    res.status(401).send({ error: "Invalid token." });
  }

  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,

      resetToken: null,
      resetTokenExpiry: null,
    }
    
  });
  res.status(200).send({ message: 'Successfully reset password.'})

});


export default router;
