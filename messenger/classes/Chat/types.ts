import { ILastMessage } from "../Message/types"
import { UserBySearch } from "core/user"

export interface IConversation {
	_id: string
	createdAt: string
	updatedAt: string
	lastSeen: string
	members: UserBySearch[]
	settings: {
		notifications: { enabled: boolean; sound: boolean; vibration: boolean }
	}
	type: "chat" | "dialog"
	unread: number
	name?: string
	lastMessage?: ILastMessage
	photo?: { link: string; preview: string }
	linkInvite: boolean
	botChat?: boolean
	isOwner: boolean
}
