import { makeAutoObservable } from "mobx";
import moment from "moment";
import User from "../../../../core/user";
import Message from "../../Message";
import { IMessagesChain, IMessageLink } from "./types";

export default class MessageLink implements IMessageLink {
  onScreen = false;

  constructor(
    readonly chainMessages: IMessagesChain,
    readonly message: Message,
    public prev: MessageLink | null = null,
    public next: MessageLink | null = null
  ) {
    makeAutoObservable(this);
  }

  get member() {
    return this.chainMessages.chat.info.members.find(
      User.byId(this.message.sender._id)
    );
  }

  get authorForward() {
    const { chainMessages, message } = this;
    if (message.forwardedMessage) {
      const member = chainMessages.chat.info.members.find(
        User.byId(message.forwardedMessage.sender._id)
      );
      return member || message.sender;
    } else {
      return null;
    }
  }

  get id() {
    return this.message._id;
  }

  /** Установить положение на экране */
  setOnScreen(onScreen: boolean) {
    this.onScreen = onScreen;
  }

  /** Дабавить предыдущее звено */
  setPrev(link: MessageLink | null = null) {
    this.prev = link;
  }
  /** Дабавить следующее звено */
  setNext(link: MessageLink | null = null) {
    this.next = link;
  }

  // for web @ts-ignore
  ref: React.RefObject<HTMLDivElement> | null = null;
  setRef(ref: null | React.RefObject<HTMLDivElement>) {
    this.ref = ref;
  }

  /** Начало в блоке отправителя */
  get isStart() {
    if (this.message.type === "system") {
      return undefined;
    }
    return (
      this.isStartOfNewMessages ||
      this.isFirst ||
      !this.prev ||
      this.prev.message.sender._id !== this.message.sender._id ||
      this.prev.message.type === "system"
    );
  }
  /** Конец в блоке отправителя */
  get isFinish() {
    if (this.message.type === "system") {
      return undefined;
    }
    return (
      !this.next ||
      this.next.isStartOfNewMessages ||
      this.next.isFirst ||
      this.next.message.sender._id !== this.message.sender._id ||
      this.next.message.type === "system"
    );
  }

  get nextAudioLink(): MessageLink | null {
    if (this.next) {
      return this.next.message.isAudio ? this.next : this.next.nextAudioLink;
    } else {
      return null;
    }
  }

  // ------ Moment ------------
  get moment() {
    return moment(this.message.createdAt);
  }
  get calendar() {
    return this.moment.calendar();
  }
  get date() {
    return this.moment.format("L");
  }
  // =========================

  /** Первое известное сообщение дня */
  get isFirst() {
    return this.prev === null || this.date !== this.prev.date;
  }

  get startOfDay(): MessageLink | undefined {
    return this.isFirst === true ? this : this.prev?.startOfDay;
  }

  /** Собственное несистемное сообщение  */
  get isSelf() {
    if (this.message.type === "system") {
      return undefined;
    }
    return this.chainMessages.chat.user.info?._id === this.message.sender._id;
  }

  /**
   * Проверяет, является ли новым сообщением в списке сообщений
   * читерский способ, но нужен в том числе для определения начала блока.
   *
   * TODO: Кандидат на переделку. Условие для определения блока можно выполнить
   * в компоненте в UI
   *  */
  get isStartOfNewMessages(): boolean {
    return this.chainMessages.chat.messages.new?.message._id === this.id;
  }

  get endOfBlock(): MessageLink | undefined {
    if (this.isFinish === undefined) {
      return undefined;
    }
    if (this.isFinish === true) {
      return this;
    }
    return this.next?.endOfBlock;
  }

  get startOfBlock(): MessageLink | undefined {
    if (this.isStart === undefined) {
      return undefined;
    }
    if (this.isStart) {
      return this;
    }
    return this.prev?.startOfBlock;
  }

  /** Фактически отображаемое сообщение */
  get layoutMessage() {
    return this.message.layoutType === "forward"
      ? this.message.forwardedMessage!
      : this.message;
  }

  // callbacks
  static byId =
    (id: string) =>
    ({ message }: MessageLink) =>
      id === message._id;

  static equalMessage =
    (equal: Message, flag = true) =>
    ({ message }: MessageLink) =>
      (equal === message) === flag;

  static equal =
    (link1: MessageLink, flag = true) =>
    (link2: MessageLink) =>
      (link1 === link2) === flag;

  static bySenderID =
    (senderID: string, flag = true) =>
    ({ message: { sender } }: MessageLink) =>
      (sender._id === senderID) === flag;

  static isSending =
    (flag = true) =>
    ({ message }: MessageLink) =>
      message.sending === flag;

  static forDB = ({ message: { sending, error } }: MessageLink) =>
    sending === false && error === false;

  static isSelf =
    (flag = true) =>
    ({ isSelf }: MessageLink) =>
      isSelf === flag;
}
