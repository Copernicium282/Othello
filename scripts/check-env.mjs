const clientId = process.env.VITE_THIRDWEB_CLIENT_ID
if (!clientId) {
  console.error('VITE_THIRDWEB_CLIENT_ID is not set. Add it to the Vercel environment and redeploy.')
  process.exit(1)
}
console.log('check-env: VITE_THIRDWEB_CLIENT_ID is set.')