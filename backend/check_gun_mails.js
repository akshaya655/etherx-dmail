import Gun from "gun"
import http from "http"

const gun = Gun({ peers: ["http://localhost:8765/gun"] })

console.log("Checking GunDB for user_mail_index:train4113@etherxinnovations.in ...")

let found = false
gun.get("user_mail_index:train4113@etherxinnovations.in").map().once((data, key) => {
  if (data && data.subject && data.subject.includes("Local Inbound SMTP Test")) {
    console.log("✅ FOUND EXACT TEST MAIL IN INDEX:", key, data.subject)
    found = true
  }
})

setTimeout(() => {
  if (!found) console.log("❌ EXACT TEST MAIL NOT FOUND IN THIS PEER")
  process.exit(0)
}, 3000)
