import { auth } from "../src/lib/auth";

async function resetPassword() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error("Verwendung: npx tsx scripts/reset-password.ts <email> <passwort>");
    process.exit(1);
  }

  await auth.api.setPassword({
    body: { newPassword: password },
    headers: { "x-user-email": email },
  });

  console.log(`Passwort fuer ${email} zurueckgesetzt.`);
}

resetPassword().catch(console.error).finally(() => process.exit(0));
