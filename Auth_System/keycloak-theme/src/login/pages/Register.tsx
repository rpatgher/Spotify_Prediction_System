// Custom register.ftl page — same shell as Login, posts to Keycloak's
// registration action. Realm uses registrationEmailAsUsername, so the form is
// just email + password + password-confirm + user_type (declarative user
// profile attribute, options: user | producer).
import { useState } from "react";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import { Icon } from "../components/Icon";
import { Labeled } from "../components/Labeled";
import { AuthLayout } from "../components/AuthLayout";
import { RolePick } from "../components/RolePick";

export default function Register(props: PageProps<Extract<KcContext, { pageId: "register.ftl" }>, I18n>) {
    const { kcContext } = props;
    const { url, messagesPerField, message, profile } = kcContext;

    const initialUserType = (() => {
        const v = profile.attributesByName?.user_type?.value;
        return v === "user" || v === "producer" ? v : "";
    })();
    const [userType, setUserType] = useState<"" | "user" | "producer">(initialUserType);
    const [userTypeError, setUserTypeError] = useState<string | undefined>(undefined);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const errorOf = (field: string) => (messagesPerField.existsError(field) ? kcSanitize(messagesPerField.get(field)) : undefined);

    return (
        <AuthLayout mode="register" loginUrl={url.loginUrl}>
            <form
                id="kc-register-form"
                className="flex flex-col gap-5"
                action={url.registrationAction}
                method="post"
                onSubmit={e => {
                    if (userType === "") {
                        e.preventDefault();
                        setUserTypeError("Selecciona un tipo de usuario.");
                        return;
                    }
                    setIsSubmitting(true);
                }}
            >
                {message !== undefined && message.type === "error" && messagesPerField.exists("global") && (
                    <div
                        className="text-[13px] leading-relaxed"
                        style={{
                            color: "oklch(0.72 0.18 25)",
                            background: "oklch(0.72 0.18 25 / 0.1)",
                            border: "1px solid oklch(0.72 0.18 25 / 0.3)",
                            borderRadius: 12,
                            padding: "12px 16px"
                        }}
                        aria-live="polite"
                        dangerouslySetInnerHTML={{ __html: kcSanitize(message.summary) }}
                    />
                )}

                <Labeled label="Correo" error={errorOf("email")}>
                    <input
                        tabIndex={1}
                        id="email"
                        name="email"
                        type="email"
                        defaultValue={(profile.attributesByName?.email?.value as string) ?? ""}
                        autoFocus
                        autoComplete="email"
                        placeholder="usuario@trackvision.ai"
                        className="field"
                        aria-invalid={messagesPerField.existsError("email")}
                    />
                </Labeled>

                <Labeled label="Contraseña" error={errorOf("password")}>
                    <input
                        tabIndex={2}
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="field"
                        aria-invalid={messagesPerField.existsError("password")}
                    />
                </Labeled>

                <Labeled label="Confirmar contraseña" error={errorOf("password-confirm")}>
                    <input
                        tabIndex={3}
                        id="password-confirm"
                        name="password-confirm"
                        type="password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="field"
                        aria-invalid={messagesPerField.existsError("password-confirm")}
                    />
                </Labeled>

                <div>
                    <div className="text-[13px] font-medium text-white/65 mb-2">Tipo de usuario</div>
                    <div className="grid grid-cols-2 gap-3">
                        <RolePick
                            active={userType === "user"}
                            onClick={() => {
                                setUserType("user");
                                setUserTypeError(undefined);
                            }}
                            icon="analyze"
                            title="Usuario normal"
                            desc="Analiza desde YouTube"
                            hue={162}
                        />
                        <RolePick
                            active={userType === "producer"}
                            onClick={() => {
                                setUserType("producer");
                                setUserTypeError(undefined);
                            }}
                            icon="upload"
                            title="Productor"
                            desc="MP3 + YouTube"
                            hue={178}
                        />
                    </div>
                    {(userTypeError ?? errorOf("user_type")) && (
                        <div className="text-[13px] mt-2" style={{ color: "oklch(0.72 0.18 25)" }}>
                            {userTypeError ?? errorOf("user_type")}
                        </div>
                    )}
                    <input type="hidden" name="user_type" value={userType} />
                </div>

                <button
                    tabIndex={4}
                    disabled={isSubmitting}
                    type="submit"
                    className="btn-primary justify-center mt-1 text-[15px] py-3.5"
                >
                    Crear cuenta <Icon name="arrow" className="w-4 h-4" />
                </button>
            </form>
        </AuthLayout>
    );
}
