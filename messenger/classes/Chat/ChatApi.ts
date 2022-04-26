import Chat from "./Chat";
import Api from "../../../core/api";
import User from "../../../core/user";
import { IAttachment } from "../../../core/attachment";
import { IConversation } from "./types";

type ResponseGetChat = { result: IConversation[] };

export default class ChatApi {
  static async createDialog(user: User, username: string) {
    const response = await Api.fetch<{ result: { roomId: string } }>(
      "api/rooms/create_dialog",
      {
        method: "POST",
        headers: { "x-access-token": user.token },
        body: JSON.stringify({
          username,
        }),
      }
    );
    return response.result.roomId;
  }

  static async createChat(
    user: User,
    name: string,
    userIds: string[],
    attachmentID?: string
  ) {
    const response = await Api.fetch<{ result: { roomId: string } }>(
      "api/rooms/create_chat",
      {
        method: "POST",
        headers: { "x-access-token": user.token },
        body: JSON.stringify({
          name,
          userIds,
          photoAttachment: attachmentID,
        }),
      }
    );

    return response.result.roomId;
  }

  // ----------- Загрузка чатов ----------

  static async getById(user: User, roomId: string) {
    const response = await Api.fetch<{ result: IConversation }>(
      `api/rooms/v1/${roomId}`,
      {
        method: "GET",
        headers: { "x-access-token": user.token },
      }
    );

    return response.result;
  }

  static async getChats(user: User, lastUpdate: number = 0) {
    const getQuery = `?withoutMembers=true&lastUpdate=${lastUpdate}`;
    const response = await Api.fetch<ResponseGetChat>(
      `api/rooms/list${getQuery}`,
      {
        method: "GET",
        headers: { "x-access-token": user.token },
      }
    );

    return response.result.map((conv) => new Chat(conv, user));
  }

  static async getBots(user: User, lastUpdate?: number) {
    const getQuery = `?lastUpdate=${lastUpdate}`;
    const response = await Api.fetch<ResponseGetChat>(
      `api/rooms/bots${getQuery}`,
      {
        method: "GET",
        headers: { "x-access-token": user.token },
      }
    );
    return response.result.map((conv) => new Chat(conv, user));
  }

  static async getArchives(user: User) {
    const response = await Api.fetch<ResponseGetChat>(
      "api/rooms/list?archived=true&withoutMembers=true",
      {
        method: "GET",
        headers: {
          "x-access-token": user.token,
        },
      }
    );
    return response.result.map((conv) => new Chat(conv, user));
  }

  // ------- Архивирование ----------

  static async archive(user: User, chat: Chat) {
    await Api.fetch("api/rooms/archive", {
      method: "POST",
      headers: { "x-access-token": user.token },
      body: JSON.stringify({
        roomId: chat.info._id,
        archived: true,
      }),
    });
  }
  static async unarchive(user: User, chat: Chat) {
    await Api.fetch("api/rooms/archive", {
      method: "POST",
      headers: { "x-access-token": user.token },
      body: JSON.stringify({
        roomId: chat.info._id,
        archived: false,
      }),
    });
  }

  // -------- Взаимодействие с пользователем ---------

  static async join(user: User, chatID: string) {
    await Api.fetch(`api/rooms/add/${chatID}`, {
      method: "POST",
      headers: { "x-access-token": user.token },
    });
  }
  static async leave(user: User, chat: Chat) {
    await Api.fetch("api/rooms/leave", {
      method: "POST",
      headers: { "x-access-token": user.token },
      body: JSON.stringify({
        roomId: chat.info._id,
      }),
    });
  }

  // -------- Обновление чата ---------
  /** Обновить данные чата */
  static async update(
    user: User,
    chat: Chat,
    newChatName: string,
    attachment?: IAttachment
  ) {
    await Api.fetch("api/rooms/update", {
      method: "POST",
      headers: { "x-access-token": user.token },
      body: JSON.stringify({
        roomId: chat.info._id,
        name: newChatName,
        photoAttachment: attachment?._id,
      }),
    });
  }
}
