import { makeAutoObservable } from "mobx"
import Api from "core/api"
import User from "core/user"
import { IConversation } from "./types"

export default class ChatSettings {
	constructor(public chatInfo: IConversation, public user: User) {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get isMute() {
		const notifications = this.chatInfo.settings.notifications
		if (notifications) {
			return !notifications.enabled
		} else {
			return false
		}
	}

	set isMute(value) {
		this.chatInfo.settings.notifications.enabled = !value
	}

	async setIsMute(isMute: boolean) {
		this.isMute = isMute
		await ChatSettings.updateSettings(this.user, this.chatInfo, {
			enabled: !isMute,
		})
	}

	async toggleMute() {
		this.setIsMute(!this.isMute)
	}

	// -------- Обновление чата ---------
	/** Настройка уведомлений */
	static async updateSettings(
		user: User,
		chatInfo: IConversation,
		notifications: { enabled: boolean },
	) {
		await Api.fetch("api/rooms/update_settings", {
			method: "POST",
			headers: { "x-access-token": user.token },
			body: JSON.stringify({
				roomId: chatInfo._id,
				notifications,
			}),
		})
	}
}
