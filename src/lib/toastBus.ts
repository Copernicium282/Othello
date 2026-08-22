export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
}

type ToastSink = ((msg: Omit<ToastMessage, 'id'>) => void) | null

let sink: ToastSink = null

export function registerToastSink(next: ToastSink) {
  sink = next
}

export function toast(type: ToastType, message: string) {
  sink?.({ type, message })
}
