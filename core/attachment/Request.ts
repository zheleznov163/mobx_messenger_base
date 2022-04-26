import { runInAction } from "mobx"
import { guid } from "utils"
import Api from "../api"
import User from "../user"
import Loader from "./Loader"
import FileIDocument from "./FileIDocument"
import { IDocument, IAttachment, IRequest } from "./types"

export default class Request implements IRequest {
	_id = guid()
	loader = new Loader()
	attachment: IAttachment | null = null

	constructor(
		protected user: User,
		public file: Pick<IDocument, "uri" | "type" | "name"> | FileIDocument,
	) {}

	get type() {
		const { file } = this
		return file.type.includes("image")
			? "image"
			: file.type.includes("video")
			? "video"
			: file.type.includes("audio")
			? "audio"
			: "file"
	}

	// Запрос
	protected async getRequest() {
		const { file, type, user } = this

		const xhr = new XMLHttpRequest()
		xhr.open(
			"post",
			`${Api.baseUrl}api/attachments/upload/${type === "image" ? "photo" : type}`,
			true,
		)
		xhr.setRequestHeader("x-access-token", user.token)
		if (type !== "video") {
			xhr.setRequestHeader("content-type", "multipart/form-data")
		}

		const data = new FormData()
		data.append("attachment", {
			// @ts-ignore
			uri: file.uri,
			type: type === "video" ? "video/mp4" : file.type,
			name: file.name,
		})

		xhr.send(data)
		return xhr
	}

	// Выполнение запроса
	async start() {
		const { file, user, type } = this
		return new Promise<IAttachment>(async (resolve, reject) => {
			const body = new FormData()
			if (file instanceof FileIDocument) {
				body.append("attachment", file.file, file.name)
			} else {
				body.append("attachment", {
					// @ts-ignore
					uri: file.uri,
					type: file.type,
					name: file.name,
				})
			}

			const res = await fetch(
				`${Api.baseUrl}api/attachments/upload/${type === "image" ? "photo" : type}`,
				{
					method: "POST",
					headers: { "x-access-token": user.token },
					body,
				},
			)

			if (res.ok) {
				this.attachment = (await res.json()).data as IAttachment
				resolve(this.attachment)
			} else {
				reject(res)
			}
		})
	}

	static stop = ({ loader }: Request) => loader.stop()
	static start = (req: Request) => req.start()

	static upload = (user: User, file: Pick<IDocument, "uri" | "type" | "name">) =>
		new Request(user, file)
	static uploads = (user: User, files: Pick<IDocument, "uri" | "type" | "name">[]) =>
		files.map((f) => new Request(user, f))
}
