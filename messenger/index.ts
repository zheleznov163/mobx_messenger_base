export { Message, Chat, Emotion } from "./classes"
export { MessageSearch } from "./classes/Message"
export { default as MessagesChain, MessageLink } from "./classes/Chat/MessagesChain"
export { default as MessengerStore } from "./MessengerStore"
export type { IEmotion } from "./classes/Message"
export type { IRecord } from "./classes/Storage"

// ------ Альтернативный импорт ----------------
import MessengerStore from "./MessengerStore"
export default MessengerStore
