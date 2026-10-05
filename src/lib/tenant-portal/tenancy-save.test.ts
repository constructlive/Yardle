import { beforeEach, describe, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({query:vi.fn(),db:true,saveDemoUnit:vi.fn(),unit:{id:"u",estateId:"e",unitReference:"1",tenantName:"Old tenant",tenantContactName:"Old",tenantEmail:"old@example.test",tenantMobile:"07000000000",status:"active",tenantAccessToken:"old-token-which-must-not-follow-the-tenant"}}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("../db",()=>({ensureSeeded:async()=>{},hasDatabaseUrl:()=>state.db,query:state.query,transaction:vi.fn()}));
vi.mock("../data",()=>({getAppData:async()=>({units:[state.unit]})}));
vi.mock("../session",()=>({requireAdminSession:async()=>({userId:"admin"})}));
vi.mock("../demo-store",()=>({saveDemoUnit:state.saveDemoUnit}));
import { saveUnit } from "../actions";
function form(changed=false){const f=new FormData();for(const [key,value]of Object.entries(state.unit))f.set(key,value);f.set("unitId",state.unit.id);f.set("tenantAccessEnabled","on");if(changed)f.set("tenantName","New tenant");return f;}
beforeEach(()=>{vi.clearAllMocks();state.query.mockResolvedValue({rows:[]});state.db=true;});
describe("tenancy save revokes old access atomically",()=>{
  it("rotates the bill token in the same database update as the new tenant",async()=>{await saveUnit(form(true));const [sql,params]=state.query.mock.calls[0];expect(sql).toContain("tenant_access_token=coalesce(?,tenant_access_token)");expect(params[14]).toMatch(/^[A-Za-z0-9_-]{43}$/);expect(params[15]).toBe(params[14]);expect(params[2]).toBe("New tenant");expect(params[16]).toBe("u");});
  it("preserves existing links when the tenant has not changed",async()=>{await saveUnit(form());expect(state.query.mock.calls[0][1][14]).toBeNull();});
  it("rotates tokens in demo mode as well",async()=>{state.db=false;await saveUnit(form(true));expect(state.saveDemoUnit.mock.calls[0][1].tenantAccessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);});
});
