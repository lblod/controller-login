import { app } from "mu";
import bodyParser from "body-parser";
import { URLSearchParams } from "url";
import fetch from "node-fetch";

const HEADER_MU_SESSION_ID = "mu-session-id";
const HEADER_X_REWRITE_URL = "x-rewrite-url";
const ACM_IDM_LOGIN_ENDPOINT =
  process.env.ACM_IDM_LOGIN_ENDPOINT || "http://login";
app.use(
  bodyParser.json({
    type: function(req) {
      return /^application\/json/.test(req.get("content-type"));
    },
  }),
);

app.get("/", async function(req, res, next) {
  try {
    const code = req.query["code"];
    console.log("sess", req.get(HEADER_MU_SESSION_ID));
    console.log("code", code);
    const formData = new URLSearchParams();
    formData.append("authorizationCode", code);
    const response = await fetch(ACM_IDM_LOGIN_ENDPOINT + "/sessions", {
      method: "post",
      body: formData,
      headers: {
        //"Content-Type": "application/json",
        "mu-session-id": req.get(HEADER_MU_SESSION_ID),
        "x-rewrite-url": req.get(HEADER_X_REWRITE_URL),
        "mu-call-id": req.get("mu-call-id"),
      },
    });

    console.log("response: ", await response.text());
    console.log("status: ", response.status);
    return res.status(403).send(response);
  } catch (e) {
    return next(e);
  }
});

function error(err, _req, res, _next) {
  console.error(err.stack);
  return res.status(500).send("Something broke!");
}

app.use(error);
