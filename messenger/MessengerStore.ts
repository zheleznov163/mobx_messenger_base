import { IReactionDisposer, makeAutoObservable, runInAction } from "mobx";
import User, { IPerson } from "../core/user";
import { IAttachment } from "../core/attachment";
import Message, { IEmotion, IMessage } from "./classes/Message";
import Chat from "./classes/Chat";

export default class MessengerStore {
  chats: Chat[] = [];
  bots: Chat[] = [];
  archive: Chat[] = [];
  /** Общий список чатов */
  // entities: Chat[] = []
  /** Выбранный чат */
  active: Chat | null = null;
  opened = new Set<Chat>();

  /** Загрузки */
  loadings = {
    getChats: false,
    createChat: false,
  };

  /** Когда месенджер загрузит чаты в первый раз */
  status: "ready" | "not ready" = "not ready";

  /** Пересылаемое сообщение */
  selectedMessage: Message | null = null;

  visibleArchiveAlertInfo: boolean = true;

  constructor(public readonly user: User) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  // SomeStorage
  storage: Storage | null = null;

  disposers: IReactionDisposer[] = [];
  clearStorage() {
    this.disposers.forEach((disposer) => disposer());
    this.storage?.clear();
  }

  get allChats() {
    return [...this.chats, ...this.archive, ...this.bots];
  }

  get unreadChats() {
    return this.entities.filter(Chat.byUnread()).length;
  }

  get selfChat() {
    return this.chats.find(({ isSaved }) => isSaved);
  }

  async getChats() {
    if (!this.loadings.getChats) {
      this.loadings.getChats = true;
      this.opened.clear();
      try {
        const [chats, bots, archive] = await Promise.all([
          Chat.Api.getChats(this.user, 0),
          Chat.Api.getBots(this.user, 0),
          Chat.Api.getArchives(this.user),
        ]);
        runInAction(() => {
          this.status = "ready";
          this.chats = chats;
          this.bots = bots;
          this.archive = archive;
          this.loadings.getChats = false;
        });
      } catch (error: unknown) {
        runInAction(() => {
          this.loadings.getChats = false;
        });
      }
    }
  }
  get entities() {
    const entities = [];

    const filtred = this.chats.filter(Chat.byLastMessage);

    const indexSaved = this.selfChat ? filtred.indexOf(this.selfChat) : -1;
    if (indexSaved !== -1) {
      entities.push(...filtred.splice(indexSaved, 1));
    } else {
      entities.push(Chat.createFakeSaved(this.user));
    }
    entities.push(...this.bots);
    entities.push(...filtred);

    return entities;
  }

  // ----------- Архивы -----------------
  moveToArchive(chat: Chat) {
    const index = this.chats.indexOf(chat);
    if (index !== -1) {
      this.chats.splice(index, 1);
    }
    if (!this.archive.includes(chat)) {
      this.archive.unshift(chat);
    }
  }

  async archiveChat(chat: Chat) {
    try {
      this.moveToArchive(chat);
      await Chat.Api.archive(this.user, chat);
    } catch (error: unknown) {
      this.moveToChats(chat);
      throw error;
    }
  }

  moveToChats(chat: Chat) {
    const index = this.archive.indexOf(chat);
    if (index !== -1) {
      this.archive.splice(index, 1);
    }
    if (!this.chats.includes(chat)) {
      this.chats.unshift(chat);
    }
  }

  async unarchiveChat(chat: Chat) {
    try {
      this.moveToChats(chat);
      await Chat.Api.unarchive(this.user, chat);
    } catch (error: unknown) {
      this.moveToArchive(chat);
      throw error;
    }
  }

  //--------------- Активный чат -----------------
  clearOpened() {
    this.opened.clear();
  }

  refreshActive() {
    if (this.active && !this.active.messages.moreAfter) {
      this.active.messages.get();
      this.opened.add(this.active);
    }
  }

  setVisibleArchiveAlertInfo(visible: boolean) {
    this.visibleArchiveAlertInfo = visible;
    this.storage?.setVisibleArchiveAlertInfo(visible);
  }

  /** Открыть чат */
  setActive(chat: Chat | null) {
    if (chat) {
      if (!this.opened.has(chat)) {
        chat.messages.get().then(() => chat.messages.read());
        chat.pin.get();
        this.opened.add(chat);
      }
      chat.updateMembers();
      chat.messages.read();
    }

    this.active = chat;
    return chat;
  }

  /** Выбрать сообщение */
  selectMessage(message: Message) {
    this.selectedMessage = message;
  }

  /** Удалить выбраное сообщение */
  deleteSelectMessage() {
    this.selectedMessage = null;
  }

  /** Переслать выбранное сообщение в чат */
  forvardSelectedTo(chat: Chat) {
    if (this.selectedMessage) {
      chat.setQuote(this.selectedMessage);
      this.selectedMessage = null;
      this.setActive(chat);
    }
  }

  reorderBy(chat: Chat) {
    const index = this.chats.findIndex(Chat.equal(chat));
    // чтобы не создавать новый массив чатов
    if (index >= 1) {
      this.chats = [chat, ...this.chats.filter(Chat.equal(chat, false))];
    }
  }

  findChat = (id: Chat["id"]) =>
    this.chats.find(Chat.byId(id)) ||
    this.archive.find(Chat.byId(id)) ||
    this.bots.find(Chat.byId(id));

  async loadChat(roomID: string) {
    const info = await Chat.Api.getById(this.user, roomID);
    // Пока запрашиваем, после создания может прилететь по сокету, проверяем
    const equal = this.findChat(roomID);
    if (equal) {
      equal.setInfo(info);
      return equal;
    }
    const chat = new Chat(info, this.user);
    this.chats.unshift(chat);
    return chat;
  }

  async leaveChat(chat: Chat) {
    await chat.leave();
    if (this.chats.includes(chat)) {
      this.chats = this.chats.filter(Chat.equal(chat, false));
    }
    if (this.archive.includes(chat)) {
      this.archive = this.chats.filter(Chat.equal(chat, false));
    }
  }

  /** Создание диалога */
  async createDialog(user: Pick<IPerson, "username">) {
    return Chat.Api.createDialog(this.user, user.username);
  }

  /** Создание чата */
  async createChat(
    name: string,
    userIds: string[],
    attachment?: Pick<IAttachment, "_id">
  ) {
    if (!this.loadings.createChat) {
      try {
        this.loadings.createChat = true;
        const id = Chat.Api.createChat(
          this.user,
          name,
          userIds,
          attachment?._id
        );
        runInAction(() => {
          this.loadings.createChat = false;
        });
        return id;
      } catch (error: unknown) {
        runInAction(() => {
          this.loadings.createChat = false;
        });
        throw error;
      }
    }
  }

  addMessageToChat(message: Message, updated: Chat) {
    this.reorderBy(updated);

    updated.updateLastMessage(message);
    const isSelf = message.sender._id === updated.user.info?._id;

    if (this.active === updated) {
      if (updated.messages.moreAfter === false || isSelf) {
        Message.markReaded(this.user, updated.id, message.timestamp);
        updated.unread = 0;
      } else {
        updated.unread = updated.unread + 1;
      }
    } else {
      if (!isSelf) {
        updated.unread = updated.unread + 1;
      }
    }

    if (message.type === "system") {
      if (
        message.body.includes("закрепил новое сообщение") &&
        updated.pin.message?._id !== message._id
      ) {
        updated.pin.get();
      }

      if (message.body.includes("открепил сообщение")) {
        updated.pin.get();
      }

      if (
        message.body.includes("удалил пользователя") ||
        message.body.includes("добавил пользователя")
      ) {
        updated.updateMembers();
      }

      if (message.body.includes("изменил название группы")) {
        updated.updateInfo();
      }
    }
    return updated.messages.add(message);
  }

  /// ---------------- Обработчики внешних событий ------------------------

  /** Обработчик получения нового сообщения */
  handleRoomUpdate = async (data: EventUpdate) => {
    const message = new Message(data.message);

    let updated = this.chats.find(Chat.byId(data.roomId));
    if (updated) {
      this.addMessageToChat(message, updated);
      this.storage?.recordChats(this.chats);
      return updated;
    }

    updated = this.archive.find(Chat.byId(data.roomId));
    if (updated) {
      if (this.addMessageToChat(message, updated) && !updated.settings.isMute) {
        this.moveToChats(updated);
      }
      this.storage?.recordArchive(this.archive);
      return updated;
    }

    updated = this.bots.find(Chat.byId(data.roomId));
    if (updated) {
      this.addMessageToChat(message, updated);
      this.storage?.recordBots(this.bots);
      return updated;
    }

    updated = await this.loadChat(data.roomId);
    this.addMessageToChat(message, updated);

    return updated;
  };

  /** Обработчик прочтения */
  handleMessageRead = ({ lastSeen, roomId, user }: EventRead) =>
    this.findChat(roomId)?.readFrom(user, lastSeen);

  /** Обработчик редактирования */
  handleMessageEdit = ({ message, roomId }: EventEdit) =>
    this.findChat(roomId)?.updateMessage(message);

  /** Обработчик удаления */
  handleMessageDelete = ({ message, roomId }: EventDelete) =>
    this.findChat(roomId)?.markDelete(message);

  /** Обработчик эмоций */
  handleMessageEmotion = ({ roomId, message, emotion }: EventEmotion) =>
    this.findChat(roomId)?.toggleReactions(message, emotion);
}

type EventRead = {
  id: string;
  type: "notify_message_read";
  lastSeen: string;
  roomId: string;
  user: {
    username: string;
    _id: string;
  };
};

type EventUpdate = {
  id: string;
  type: "notify_room";
  roomId: string;
  message: IMessage;
};

type EventDelete = {
  id: string;
  type: "notify_message_delete";
  message: Pick<IMessage, "createdAt" | "sender" | "_id">;
  roomId: string;
};
type EventEdit = {
  roomId: string;
  message: IMessage;
};

type EventEmotion = {
  id: string;
  type: "notify_message_emotion";
  emotion: {
    emotion: IEmotion["emotion"];
    user: string;
  };
  message: Pick<IMessage, "createdAt" | "sender" | "_id">;
  roomId: string;
};
