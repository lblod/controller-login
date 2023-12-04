import { app } from "mu";
import bodyParser from "body-parser";

import {
  check,
  checkNotNull,
  selectAccount,
  selectCurrentSession,
  selectGroup,
  selectRoles,
  selectAccountBySession,
  removeOldSession,
  insertNewSessionForAccount,
} from "./lib/utils";

const HEADER_MU_SESSION_ID = "mu-session-id";
const HEADER_X_REWRITE_URL = "x-rewrite-url";
const CONTROLLER_ROLE = process.env.CONTROLLER_ROLE || "ControllerWOP";

app.use(
  bodyParser.json({
    type: function(req) {
      return /^application\/json/.test(req.get("content-type"));
    },
  }),
);

app.delete("/sessions/current", async function(req, res, next) {
  try {
    const sessionUri = req.get(HEADER_MU_SESSION_ID);
    checkNotNull(sessionUri, "session uri missing");
    const { accountUri } = await selectAccountBySession(sessionUri);
    checkNotNull(accountUri, "invalid session");
    await removeOldSession(sessionUri);

    return res.header("mu-auth-allowed-groups", "CLEAR").status(204).end();
  } catch (e) {
    return next(e);
  }
});

app.get("/sessions/current", async function(req, res, next) {
  try {
    const sessionUri = req.get(HEADER_MU_SESSION_ID);
    checkNotNull(sessionUri, "sessionUri missing");
    const currentSession = await getCurrentSession(
      req.get(HEADER_MU_SESSION_ID),
    );

    return res.status(200).send(currentSession);
  } catch (e) {
    return next(e);
  }
});

app.post("/sessions", async function(req, res, next) {
  try {
    const sessionUri = req.get(HEADER_MU_SESSION_ID);
    checkNotNull(sessionUri, "sessionUri missing");
    const rewriteUrl = req.get(HEADER_X_REWRITE_URL);
    checkNotNull(rewriteUrl, "rewrite url missing");

    const currentSession = await getCurrentSession(
      req.get(HEADER_MU_SESSION_ID),
    );

    const roles = currentSession?.data?.attributes?.roles;

    if (roles.includes(CONTROLLER_ROLE)) {
      const data = req.body.data;
      checkNotNull(data, "data is null");
      check(data.type === "sessions", "data type is invalid");
      check(
        data.id === null || data.id === undefined,
        "Id paramater is not allowed",
      );
      const accountId = data.relationships?.account?.data?.id;
      const groupId = data.relationships?.group?.data?.id;

      checkNotNull(accountId, "exactly one account should be linked");
      checkNotNull(groupId, "exactly one group should be linked");

      const account = await selectAccount(accountId);
      checkNotNull(account, "missing account " + accountId);
      const group = await selectGroup(groupId);
      checkNotNull(group, "missing group " + groupId);
      const roles = await selectRoles(accountId);
      checkNotNull(roles, "missing roles " + accountId);

      await removeOldSession(sessionUri);
      const { sessionId } = await insertNewSessionForAccount(
        account,
        sessionUri,
        group,
        roles,
      );

      return res
        .header("mu-auth-allowed-groups", "CLEAR")
        .status(201)
        .send({
          links: {
            self: "/sessions/current",
          },
          data: {
            type: "sessions",
            id: sessionId,
            attributes: {
              roles: roles,
            },
          },
          relationships: {
            account: {
              links: { related: `/accounts/${accountId}` },
              data: { type: "accounts", id: accountId },
            },
            group: {
              links: { related: `/bestuurseenheden/${groupId}` },
              data: { type: "bestuurseenheden", id: groupId },
            },
          },
        });
    } else {
      console.log("role ", CONTROLLER_ROLE, "missing in ", roles);
      return res.header("mu-auth-allowed-groups", "CLEAR").redirect("/logout");
    }
  } catch (e) {
    return next(e);
  }
});

async function getCurrentSession(sessionUri) {
  const { accountUri, accountId } = await selectAccountBySession(sessionUri);

  if (!accountUri) throw "Invalid session";
  const { sessionId, groupId, roles } = await selectCurrentSession(accountUri);
  return {
    links: {
      self: "/sessions/current",
    },
    data: {
      type: "sessions",
      id: sessionId,
      attributes: {
        roles: roles,
      },
    },
    relationships: {
      account: {
        links: { related: `/accounts/${accountId}` },
        data: { type: "accounts", id: accountId },
      },
      group: {
        links: { related: `/bestuurseenheden/${groupId}` },
        data: { type: "bestuurseenheden", id: groupId },
      },
    },
  };
}
function error(err, _req, res, _next) {
  console.log("error!: ", err);
  return res.status(500).send("Something broke!");
}

app.use(error);
