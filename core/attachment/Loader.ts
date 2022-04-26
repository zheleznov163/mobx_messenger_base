import { guid } from "utils"
import { makeAutoObservable } from "mobx"

type Progress = { loaded: number; total: number }
type Status = "error" | "loading" | "done" | "hold"

export default class Loader {
	// Это и есть ключевое различие
	// --------
	_id = guid()
	constructor() {
		makeAutoObservable(this)
	}

	/*  --------------- Процесс загрузки --------------------- */

	/** Отменяемый объект загрузки */
	private current?: { abort(): void }
	/** Установить объект загрузки */
	setCurrent(current: Loader["current"]) {
		this.current = current
	}

	/** Функция остановки */
	private reject: ((reason?: any) => void) | null = null
	/** Установить функцию остановки */
	setReject(reject: ((reason?: any) => void) | null) {
		this.reject = reject
	}

	/*  --------------- Процесс загрузки --------------------- */
	status: Status = "hold"
	setStatus(status: Status) {
		this.status = status
	}

	/**  Отменить загрузку  */
	abort() {
		this.current?.abort()
		this.setStatus("hold")
		this.progress = null
	}

	/**  Остановить загрузку  */
	stop() {
		if (this.reject && this.status === "loading") {
			this.reject()
			this.setStatus("hold")
		}
	}

	/* -------------- Прогресс ---------------------- */

	progress: Progress | null = null
	setProgress({ loaded, total }: Progress) {
		this.progress = { loaded, total }
	}
	get percents() {
		if (this.progress) {
			const { total, loaded } = this.progress
			return loaded / (total / 100)
		}
		return null
	}
}
