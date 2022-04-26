import { getDeclension } from "utils"
import { IAttachment } from "./types"
import Request from "./Request"

export default class Attachment {
	static Request: typeof Request = Request

	static setRequest(R: typeof Request) {
		this.Request = R
	}

	static split = <T extends any>(objects: T[], by: number) =>
		objects.reduce((acc, obj, index) => {
			const accIndex = Math.trunc(index / by)
			if (acc[accIndex]) {
				acc[accIndex].push(obj)
			} else {
				acc[accIndex] = [obj]
			}
			return acc
		}, [] as T[][])

	static getName(type: IAttachment["type"], length: number) {
		switch (type) {
			case "sticker":
				return "🌄 Стикер"
			case "audio":
				return "🔈 Аудиосообщение"
			case "file":
				if (length === 1) {
					return "📎 Фаил"
				}
				return `📎 ${length} ${getDeclension(length, ["фаил", "файла", "файлов"])}`
			case "image":
				if (length === 1) {
					return "🌄 Изображение"
				}
				return `🌄 ${length} ${getDeclension(length, [
					"изобаражение",
					"изображения",
					"изображений",
				])}`
			case "video":
				if (length === 1) {
					return "📹 Видео"
				}
				return `🌄 ${length} видео`
			default:
				return ""
		}
	}
}
