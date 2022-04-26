import { makeAutoObservable, runInAction, reaction } from "mobx";
import User, { SearchUsersValues } from "./core/user";
import Api from "./core/api";
import MessengerStore from "./messenger";
import SocketsStore from "sockets";
import AuthStore from "./AuthStore";

export default class MainStore {
  auth = new AuthStore();
  messenger: MessengerStore | null = null;
  sockets: SocketsStore | null = null;

  /**  набор фильтров для поиска пользователей */
  searchValues?: SearchUsersValues;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
    Api.configure(true);
    this.checkAuth(this.auth.user);
    reaction(() => this.auth.user, this.checkAuth);
  }

  private checkAuth(user: User | null) {
    user ? this.login(user) : this.logout();
  }

  private login(user: User) {
    user.sync();
    this.getSearchUsersValues(user);
    this.initStores(user);
    this.initSockets(user);
    this.preload();
  }

  private logout() {
    this.sockets?.disconnect();
    this.sockets = null;
    this.messenger = null;
  }

  private async getSearchUsersValues(user: User) {
    const searchValues = await User.getSearchUsersValues(user);
    runInAction(() => {
      this.searchValues = searchValues;
    });
  }

  private initStores(user: User) {
    this.sockets = new SocketsStore(user);
    this.messenger = new MessengerStore(user);
  }

  private initSockets(user: User) {
    const { sockets, messenger } = this;
    if (sockets && messenger && user) {
      sockets.connect();
      sockets.on("authorized", () => User.getAlertState(user));

      sockets.on("disconnect", async () => {
        messenger.clearOpened();
        await sockets.reqReconect();
        messenger.refreshActive();
      });
      sockets.on("notify_room", messenger.handleRoomUpdate);
      sockets.on("notify_message_read", messenger.handleMessageRead);
      sockets.on("notify_message_edit", messenger.handleMessageEdit);
      sockets.on("notify_message_delete", messenger.handleMessageDelete);
      sockets.on("notify_message_emotion", messenger.handleMessageEmotion);
    }
  }

  private preload() {
    this.messenger?.getChats();
  }
}
