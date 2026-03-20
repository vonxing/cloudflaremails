"use client"

import { ArrowRight, Lock, User } from "lucide-react"
import { useEffect, useId, useRef } from "react"
import type { ReactElement } from "react"

import { useTheme } from "@/components/theme-provider"

const vertexSmokeySource = `
  attribute vec4 a_position;
  void main() {
    gl_Position = a_position;
  }
`

const fragmentSmokeySource = `
precision mediump float;

uniform vec2 iResolution;
uniform float iTime;
uniform vec2 iMouse;
uniform vec3 u_color;

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 uv = fragCoord / iResolution;
    vec2 centeredUV = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);

    float time = iTime * 0.5;

    vec2 mouse = iMouse / iResolution;
    vec2 rippleCenter = 2.0 * mouse - 1.0;

    vec2 distortion = centeredUV;
    for (float i = 1.0; i < 8.0; i++) {
        distortion.x += 0.5 / i * cos(i * 2.0 * distortion.y + time + rippleCenter.x * 3.1415);
        distortion.y += 0.5 / i * cos(i * 2.0 * distortion.x + time + rippleCenter.y * 3.1415);
    }

    float wave = abs(sin(distortion.x + distortion.y + time));
    float glow = smoothstep(0.9, 0.2, wave);

    fragColor = vec4(u_color * glow, 1.0);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
`

type BlurSize = "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"

type LoginFormProps = {
  error?: string
  username: string
  password: string
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: () => void
  onGuestLogin: () => void
}

interface SmokeyBackgroundProps {
  backdropBlurAmount?: string
  color?: string
  className?: string
}

const blurClassMap: Record<BlurSize, string> = {
  none: "backdrop-blur-none",
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
  "2xl": "backdrop-blur-2xl",
  "3xl": "backdrop-blur-3xl",
}

export function SmokeyBackground({
  backdropBlurAmount = "sm",
  color = "#1E40AF",
  className = "",
}: SmokeyBackgroundProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mousePositionRef = useRef({ x: 0, y: 0 })
  const hoveringRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const gl = canvas.getContext("webgl")
    if (!gl) {
      return
    }

    const hexToRgb = (hex: string): [number, number, number] => {
      const r = parseInt(hex.substring(1, 3), 16) / 255
      const g = parseInt(hex.substring(3, 5), 16) / 255
      const b = parseInt(hex.substring(5, 7), 16) / 255
      return [r, g, b]
    }

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type)
      if (!shader) {
        return null
      }

      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader)
        return null
      }

      return shader
    }

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSmokeySource)
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSmokeySource)
    if (!vertexShader || !fragmentShader) {
      return
    }

    const program = gl.createProgram()
    if (!program) {
      return
    }

    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program)
      return
    }

    gl.useProgram(program)

    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )

    const positionLocation = gl.getAttribLocation(program, "a_position")
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    const iResolutionLocation = gl.getUniformLocation(program, "iResolution")
    const iTimeLocation = gl.getUniformLocation(program, "iTime")
    const iMouseLocation = gl.getUniformLocation(program, "iMouse")
    const uColorLocation = gl.getUniformLocation(program, "u_color")

    const [r, g, b] = hexToRgb(color)
    gl.uniform3f(uColorLocation, r, g, b)

    let frameId = 0
    const startTime = performance.now()

    const render = (timestamp: number) => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      gl.viewport(0, 0, width, height)

      const currentTime = (timestamp - startTime) / 1000
      const mouse = mousePositionRef.current
      const pointerX = hoveringRef.current ? mouse.x : width / 2
      const pointerY = hoveringRef.current ? height - mouse.y : height / 2

      gl.uniform2f(iResolutionLocation, width, height)
      gl.uniform1f(iTimeLocation, currentTime)
      gl.uniform2f(iMouseLocation, pointerX, pointerY)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      frameId = window.requestAnimationFrame(render)
    }

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mousePositionRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
    }

    const handleMouseEnter = () => {
      hoveringRef.current = true
    }

    const handleMouseLeave = () => {
      hoveringRef.current = false
    }

    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("mouseenter", handleMouseEnter)
    canvas.addEventListener("mouseleave", handleMouseLeave)
    frameId = window.requestAnimationFrame(render)

    return () => {
      window.cancelAnimationFrame(frameId)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("mouseenter", handleMouseEnter)
      canvas.removeEventListener("mouseleave", handleMouseLeave)
      gl.deleteProgram(program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
      if (positionBuffer) {
        gl.deleteBuffer(positionBuffer)
      }
    }
  }, [color])

  const finalBlurClass = blurClassMap[backdropBlurAmount as BlurSize] ?? blurClassMap.sm

  return (
    <div className={`absolute inset-0 h-full w-full overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className={`absolute inset-0 ${finalBlurClass}`} />
    </div>
  )
}

export function LoginForm({
  error,
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onGuestLogin,
}: LoginFormProps) {
  const { theme, setTheme } = useTheme()
  const emailId = useId()
  const passwordId = useId()

  return (
    <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/30 bg-white/14 p-8 text-white shadow-2xl backdrop-blur-xl dark:border-white/20 dark:bg-slate-950/24">
      <div className="flex items-start justify-between gap-3">
        <div className="text-left">
          <h2 className="text-3xl font-bold text-slate-950 dark:text-white">Welcome Back</h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-white/75">Sign in to continue</p>
        </div>
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full border border-slate-300/70 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-800 transition hover:bg-white dark:border-white/25 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>

      <form
        className="space-y-8"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <div className="relative z-0">
          <input
            type="text"
            id={emailId}
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            className="peer block w-full appearance-none border-0 border-b-2 border-slate-500/55 bg-transparent px-0 py-2.5 text-sm text-slate-950 focus:border-blue-600 focus:outline-none focus:ring-0 dark:border-white/55 dark:text-white dark:focus:border-blue-300"
            placeholder=" "
            required
          />
          <label
            htmlFor={emailId}
            className="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-slate-700 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-700 dark:text-white/72 dark:peer-focus:text-blue-200"
          >
            <User className="mr-2 -mt-1 inline-block" size={16} />
            Email Address
          </label>
        </div>

        <div className="relative z-0">
          <input
            type="password"
            id={passwordId}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            className="peer block w-full appearance-none border-0 border-b-2 border-slate-500/55 bg-transparent px-0 py-2.5 text-sm text-slate-950 focus:border-blue-600 focus:outline-none focus:ring-0 dark:border-white/55 dark:text-white dark:focus:border-blue-300"
            placeholder=" "
            required
          />
          <label
            htmlFor={passwordId}
            className="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-slate-700 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-700 dark:text-white/72 dark:peer-focus:text-blue-200"
          >
            <Lock className="mr-2 -mt-1 inline-block" size={16} />
            Password
          </label>
        </div>

        <div className="flex items-center justify-between">
          <a href="#" className="text-xs text-slate-700 transition hover:text-slate-950 dark:text-white/72 dark:hover:text-white">
            Forgot Password?
          </a>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          className="group flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-all duration-300 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 focus:outline-none"
        >
          Sign In
          <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
        </button>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-slate-400/40 dark:border-white/20" />
          <span className="mx-4 flex-shrink text-xs text-slate-600 dark:text-white/58">
            OR CONTINUE WITH
          </span>
          <div className="flex-grow border-t border-slate-400/40 dark:border-white/20" />
        </div>

        <button
          type="button"
          onClick={onGuestLogin}
          className="flex w-full items-center justify-center rounded-lg bg-white/90 px-4 py-2.5 font-semibold text-slate-800 transition-all duration-300 hover:bg-white focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none"
        >
          <User className="mr-2 h-5 w-5" />
          Visitor Login
        </button>
      </form>

      <p className="text-center text-xs text-slate-700 dark:text-white/60">
        访客登录会自动使用演示账号进入，不会请求第三方登录。
      </p>
    </div>
  )
}
