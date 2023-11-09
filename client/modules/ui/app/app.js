import { LightningElement } from "lwc";
import { getHostAndSession, getCurrentTab } from "util/session";
export default class App extends LightningElement {
  title = "Hello the world";
  cookie;

  async connectedCallback() {
    const tab = await getCurrentTab();
    this.cookie = await getHostAndSession(tab);
  }

  get domain() {
    return this.cookie?.domain || "empty";
  }

  get session() {
    return this.cookie?.session || "empty";
  }
}
