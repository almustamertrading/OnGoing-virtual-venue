"""Builds a production-shaped dataset (structure, statuses and amounts only; placeholder text) for the isolated mirror."""
import json, sys
d = json.load(open(sys.argv[1]))
ORG = d["org"][0][0]
ADMIN = "5ac7937e-9275-4eba-8ea0-45572e473abf"
P2022 = "02784466-8f7d-44e0-81a6-22c135b55fe7"
q = lambda v: "null" if v is None else ("'" + str(v).replace("'", "''") + "'")
b = lambda v: "true" if v else "false"
out = ["set session_replication_role = replica;", "begin;"]
out.append(f"insert into public.organizations (id, name, email_domain) values ({q(ORG)}, 'Mirror Org', null);")
for i, (uid, org, role) in enumerate(d["users"], 1):
    email = f"user{i}@mirror-users.test"
    banned = "null" if uid == ADMIN else "'2999-01-01'"
    out.append(
        "insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, "
        "raw_app_meta_data, raw_user_meta_data, created_at, updated_at, banned_until, confirmation_token, "
        "recovery_token, email_change_token_new, email_change) values ("
        f"'00000000-0000-0000-0000-000000000000', {q(uid)}, 'authenticated', 'authenticated', {q(email)}, "
        "extensions.crypt('Mirror-Local-Only-1!', extensions.gen_salt('bf')), now(), "
        "'{\"provider\":\"email\",\"providers\":[\"email\"]}', '{}', now(), now(), " + banned + ", '', '', '', '');")
    out.append(f"insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at) "
               f"values (gen_random_uuid(), {q(uid)}, jsonb_build_object('sub', {q(uid)}, 'email', {q(email)}), 'email', {q(uid)}, now(), now(), now());")
    out.append(f"insert into public.profiles (id, email, display_name) values ({q(uid)}, {q(email)}, 'user{i}');")
    if org:
        out.append(f"insert into public.organization_members (organization_id, user_id, role) values ({q(org)}, {q(uid)}, {q(role)});")
for i, (cid, by) in enumerate(d["clients"], 1):
    out.append(f"insert into public.clients (id, organization_id, name, created_by) values ({q(cid)}, {q(ORG)}, 'Client {i}', {q(by)});")
for pid, cid, code, status, ptype, budget, sd, ed, by in d["projects"]:
    out.append("insert into public.projects (id, organization_id, client_id, code, name, status, project_type, budget, start_date, end_date, created_by) "
               f"values ({q(pid)}, {q(ORG)}, {q(cid)}, {q(code)}, {q('Project ' + code)}, {q(status)}, {q(ptype)}, {budget if budget is not None else 'null'}, {q(sd)}, {q(ed)}, {q(by)});")
for pid, uid, role in d["members"]:
    out.append(f"insert into public.project_members (project_id, user_id, role) values ({q(pid)}, {q(uid)}, {q(role)});")
for vid, pid, by in d["venues"]:
    out.append(f"insert into public.venues (id, project_id, name, center_lng, center_lat, created_by) values ({q(vid)}, {q(pid)}, 'Venue', 46.7, 24.7, {q(by)});")
for lid, pid, vid, by in d["layouts"]:
    out.append(f"insert into public.layouts (id, project_id, venue_id, name, created_by) values ({q(lid)}, {q(pid)}, {q(vid)}, 'Layout', {q(by)});")
for lid, pid, n, by in d["layout_items"]:
    out.append(f"insert into public.layout_items (layout_id, project_id, kind, label, x, y, w, h, created_by) "
               f"select {q(lid)}, {q(pid)}, 'chair', 'item ' || g, g * 10, 0, 1, 1, {q(by)} from generate_series(1, {n}) g;")
for rid, pid, status, by in d["rfqs"]:
    out.append(f"insert into public.rfqs (id, project_id, title, status, created_by) values ({q(rid)}, {q(pid)}, 'RFQ', {q(status)}, {q(by)});")
for i, sid in enumerate(d["suppliers"], 1):
    out.append(f"insert into public.suppliers (id, organization_id, name, created_by) values ({q(sid)}, {q(ORG)}, 'Supplier {i}', {q(ADMIN)});")
RFQ = d["rfqs"][0][0]
for qid, sid, amount, status in d["quotes"]:
    out.append(f"insert into public.quotes (id, rfq_id, project_id, supplier_id, supplier_name, amount, status, created_by) "
               f"values ({q(qid)}, {q(RFQ)}, {q(P2022)}, {q(sid)}, 'Supplier', {amount}, {q(status)}, {q(ADMIN)});")
prop, client, pstatus = d["proposal"]
out.append(f"insert into public.proposals (id, organization_id, client_id, reference, title, status, owner_id, created_by) "
           f"values ({q(prop)}, {q(ORG)}, {q(client)}, 'ONG-PRO-2026-0001', 'Proposal', {q(pstatus)}, {q(ADMIN)}, {q(ADMIN)});")
for i, sid in enumerate(d["sections"], 1):
    out.append(f"insert into public.proposal_sections (id, proposal_id, organization_id, heading, body, sort_order, created_by) "
               f"values ({q(sid)}, {q(prop)}, {q(ORG)}, 'Section {i}', 'Body', {i}, {q(ADMIN)});")
for i, (iid, qty, cost, price, opt) in enumerate(d["items"], 1):
    out.append(f"insert into public.proposal_items (id, proposal_id, organization_id, description, quantity, unit_cost, unit_price, is_optional, sort_order, created_by) "
               f"values ({q(iid)}, {q(prop)}, {q(ORG)}, 'Item {i}', {qty}, {cost}, {price}, {b(opt)}, {i}, {q(ADMIN)});")
for i, (iid, qty, rate) in enumerate(d["inventory"], 1):
    out.append(f"insert into public.inventory_items (id, organization_id, name, quantity, unit_rate, created_by) values ({q(iid)}, {q(ORG)}, 'Stock {i}', {qty}, {rate}, {q(ADMIN)});")
for i, (iid, amount, status, due) in enumerate(d["invoices"], 1):
    out.append(f"insert into public.invoices (id, project_id, number, title, amount, status, due_date, created_by) "
               f"values ({q(iid)}, {q(P2022)}, 'INV-{i}', 'Invoice {i}', {amount}, {q(status)}, {q(due)}, {q(ADMIN)});")
for i, (eid, amount) in enumerate(d["expenses"], 1):
    out.append(f"insert into public.expenses (id, project_id, label, amount, created_by) values ({q(eid)}, {q(P2022)}, 'Expense {i}', {amount}, {q(ADMIN)});")
for i, (pid, status, due) in enumerate(d["tasks"], 1):
    out.append(f"insert into public.tasks (project_id, title, status, due_date, created_by) values ({q(pid)}, 'Task {i}', {q(status)}, {q(due)}, {q(ADMIN)});")
for i, pid in enumerate(d["milestones"], 1):
    out.append(f"insert into public.milestones (project_id, title, due_date, created_by) values ({q(pid)}, 'Milestone {i}', '2027-01-10', {q(ADMIN)});")
out.append(f"insert into public.team_roles (project_id, title, created_by) select {q(d['team_roles_project'])}, 'Role ' || g, {q(ADMIN)} from generate_series(1, {d['team_roles_count']}) g;")
out.append(f"insert into public.boq_items (project_id, description, created_by) select {q(P2022)}, 'BOQ ' || g, {q(ADMIN)} from generate_series(1, {d['boq_count']}) g;")
for pid, etype, n in d["activity"]:
    out.append(f"insert into public.activity (project_id, actor_id, action, entity_type, entity_id, details) "
               f"select {q(pid)}, {q(ADMIN)}, 'created', {q(etype)}, gen_random_uuid(), '{{\"label\":\"x\"}}' from generate_series(1, {n});")
out.append("commit;")
out.append("set session_replication_role = origin;")
print("\n".join(out))
