import {
  uuid,
  sparqlEscapeUri,
  sparqlEscapeString,
  sparqlEscapeDateTime,
} from "mu";
import { querySudo as query, updateSudo as update } from "@lblod/mu-auth-sudo";
const APPLICATION_GRAPH = "http://mu.semte.ch/graphs/public";
const SESSION_GRAPH =
  process.env.SESSION_GRAPH || "http://mu.semte.ch/graphs/sessions";

export const ACCOUNT_GRAPH_TEMPLATE =
  process.env.ACCOUNT_GRAPH_TEMPLATE ||
  "http://mu.semte.ch/graphs/organizations/{{groupId}}";
export const ORGANIZATION_TYPE =
  "http://data.vlaanderen.be/ns/besluit#Bestuurseenheid";
export function getRewriteUrlHeader(request) {
  return request.get("x-rewrite-url");
}
function accountGraphFor(params) {
  return ACCOUNT_GRAPH_TEMPLATE.replace("{{groupId}}", params.groupId);
}
export function checkNotNull(obj, msg = "value is null") {
  if (!obj) {
    throw msg;
  }
}

export function check(cond, msg = "condition is false") {
  if (!cond) {
    throw msg;
  }
}

export async function selectAccount(id) {
  const queryResult = await query(`
  PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX foaf: <http://xmlns.com/foaf/0.1/>
  SELECT ?uri WHERE {
     GRAPH <${APPLICATION_GRAPH}> {
        ?group a besluit:Bestuurseenheid ;
        mu:uuid ?group_uuid .
     }
     GRAPH ?g {
        ?uri a foaf:OnlineAccount ;
        mu:uuid ${sparqlEscapeString(id)}.
         ?person a foaf:Person;
                 foaf:account ?uri;
                 foaf:member ?group.
     }
     BIND(IRI(CONCAT("http://mu.semte.ch/graphs/organizations/", ?group_uuid)) as ?g)
  }
`);
  if (queryResult.results.bindings.length) {
    const result = queryResult.results.bindings[0];
    return result.uri.value;
  } else {
    return null;
  }
}
export async function selectGroup(id) {
  const queryResult = await query(`
  PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX foaf: <http://xmlns.com/foaf/0.1/>
  SELECT ?group WHERE {
    GRAPH <${APPLICATION_GRAPH}> {
      ?group a besluit:Bestuurseenheid ;
      mu:uuid ${sparqlEscapeString(id)}.
    }

  }

`);
  if (queryResult.results.bindings.length) {
    const result = queryResult.results.bindings[0];
    return result.group.value;
  } else {
    return null;
  }
}
export async function selectRoles(id) {
  const queryResult = await query(`
  PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX foaf: <http://xmlns.com/foaf/0.1/>
  SELECT distinct ?role WHERE  {
    GRAPH <${APPLICATION_GRAPH}> {
      ?group a besluit:Bestuurseenheid ;
      mu:uuid ?group_uuid.
    }
    GRAPH ?g {
      ?uri a foaf:OnlineAccount ;
      mu:uuid ${sparqlEscapeString(id)};
      <http://mu.semte.ch/vocabularies/ext/sessionRole> ?role.
       ?person a foaf:Person;
               foaf:account ?uri;
               foaf:member ?group.
    }
    BIND(IRI(CONCAT("http://mu.semte.ch/graphs/organizations/", ?group_uuid)) as ?g)

  }
`);
  if (queryResult.results.bindings.length) {
    return queryResult.results.bindings.map((b) => b.role.value);
  } else {
    return null;
  }
}

export async function removeOldSession(sessionUri) {
  await update(
    `PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
     PREFIX session: <http://mu.semte.ch/vocabularies/session/>
     PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
     PREFIX dcterms: <http://purl.org/dc/terms/>

     DELETE WHERE {
       GRAPH ${sparqlEscapeUri(SESSION_GRAPH)} {
           ${sparqlEscapeUri(sessionUri)} session:account ?account ;
                                          mu:uuid ?id ;
                                          dcterms:modified ?modified ;
                                          ext:sessionRole ?role ;
                                          ext:sessionGroup ?group .
       }
     }`,
  );
}

export async function insertNewSessionForAccount(
  accountUri,
  sessionUri,
  groupUri,
  roles,
) {
  const sessionId = uuid();
  const now = new Date();

  // prettier-ignore
  let insertData = `
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX session: <http://mu.semte.ch/vocabularies/session/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX dcterms: <http://purl.org/dc/terms/>

    INSERT DATA {
      GRAPH ${sparqlEscapeUri(SESSION_GRAPH)} {
        ${sparqlEscapeUri(sessionUri)} mu:uuid ${sparqlEscapeString(sessionId)} ;
                                 session:account ${sparqlEscapeUri(accountUri)} ;
                                 ext:sessionGroup ${sparqlEscapeUri(groupUri)} ;
                                 ext:sessionRole ${roles.map((r) => sparqlEscapeString(r)).join(", ")};
                                 dcterms:modified ${sparqlEscapeDateTime(now)}.
        }
    }

 `;

  await update(insertData);
  return { sessionUri, sessionId };
}
async function getGroupIdForSession(session) {
  const queryResult = await query(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    SELECT DISTINCT ?groupId WHERE {
       GRAPH ${sparqlEscapeUri(SESSION_GRAPH)} {
          ${sparqlEscapeUri(session)} ext:sessionGroup ?group .
      }
      GRAPH <${APPLICATION_GRAPH}> {
      ?group a ${sparqlEscapeUri(ORGANIZATION_TYPE)} ;
             mu:uuid ?groupId .
      }
      }
  `);
  if (queryResult.results.bindings.length) {
    const result = queryResult.results.bindings[0];
    return result.groupId.value;
  } else return null;
}
export async function selectAccountBySession(session) {
  const groupId = await getGroupIdForSession(session);
  const queryResult = await query(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX session: <http://mu.semte.ch/vocabularies/session/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>

    SELECT ?account ?accountId
    WHERE {
       GRAPH ${sparqlEscapeUri(SESSION_GRAPH)} {
          ${sparqlEscapeUri(session)} session:account ?account.
      }
      GRAPH ${sparqlEscapeUri(accountGraphFor({ groupId }))} {
          ?account a foaf:OnlineAccount ;
                   mu:uuid ?accountId .
      }
    }`);

  if (queryResult.results.bindings.length) {
    const result = queryResult.results.bindings[0];
    return {
      accountUri: result.account.value,
      accountId: result.accountId.value,
    };
  } else {
    return { accountUri: null, accountId: null };
  }
}
