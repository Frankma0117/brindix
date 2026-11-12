package com.brindix.platform;

import com.brindix.common.AppProperties;
import com.brindix.security.CurrentUser;
import com.brindix.staff.StaffDtos;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class PlatformController {

    private final PlatformService service;
    private final AppProperties props;
    private final com.brindix.common.MailService mail;

    public PlatformController(PlatformService service, AppProperties props, com.brindix.common.MailService mail) {
        this.service = service;
        this.props = props;
        this.mail = mail;
    }

    @PostMapping("/api/platform/login")
    public PlatformService.LoginResponse login(@Valid @RequestBody PlatformService.LoginRequest in) {
        return service.login(in);
    }

    @GetMapping("/api/platform/venues")
    public List<PlatformService.VenueRow> venues() {
        return service.list();
    }

    @PostMapping("/api/platform/venues")
    public PlatformService.VenueRow create(@Valid @RequestBody PlatformService.VenueCreate in) {
        return service.create(in);
    }

    @PutMapping("/api/platform/venues/{id}")
    public PlatformService.VenueRow update(@PathVariable Long id, @Valid @RequestBody PlatformService.VenueUpdate in) {
        return service.update(id, in);
    }

    @PostMapping("/api/platform/password")
    public Map<String, String> changePassword(@Valid @RequestBody StaffDtos.PasswordChange in) {
        return Map.of("token", service.changePassword(CurrentUser.get(), in));
    }

    /** Estado del correo saliente (para el panel de la plataforma). */
    @GetMapping("/api/platform/mail")
    public Map<String, Object> mailStatus() {
        return Map.of("enabled", mail.enabled(), "from", props.mail() == null ? "" : String.valueOf(props.mail().from()),
                "adminEmail", mail.adminEmail() == null ? "" : mail.adminEmail());
    }

    /** Correo de prueba al súper administrador. */
    @PostMapping("/api/platform/mail/test")
    public Map<String, String> mailTest() {
        if (!mail.enabled()) throw com.brindix.common.ApiException.badRequest("El correo no está configurado (BRINDIX_MAIL_HOST)");
        mail.send(mail.adminEmail(), "Prueba de correo de Brindix", "El correo de Brindix funciona",
                java.util.List.of("Este es un correo de prueba enviado desde la plataforma. Si te llegó a la bandeja de entrada, los códigos de recuperación y los avisos de seguridad también llegarán."),
                null, "Abrir la plataforma", props.publicBase() + "/plataforma");
        return Map.of("message", "Correo de prueba enviado a " + mail.adminEmail());
    }

    /** Olvidé mi contraseña (súper administrador): código a su correo. */
    @PostMapping("/api/platform/forgot")
    public Map<String, String> forgot(@Valid @RequestBody PlatformService.ForgotInput in, jakarta.servlet.http.HttpServletRequest req) {
        service.forgot(in, com.brindix.common.ClientIp.of(req));
        return Map.of("message", "Si el usuario existe y tiene correo, te enviamos un código. Revisa también la carpeta de spam.");
    }

    @PostMapping("/api/platform/reset-code")
    public Map<String, String> resetCode(@Valid @RequestBody PlatformService.CodeResetInput in, jakarta.servlet.http.HttpServletRequest req) {
        service.resetWithCode(in, com.brindix.common.ClientIp.of(req));
        return Map.of("message", "Contraseña restablecida. Ya puedes entrar.");
    }

    /** Olvidé mi contraseña (súper administrador): con la clave de recuperación del servidor. */
    @PostMapping("/api/platform/recover")
    public Map<String, String> recover(@Valid @RequestBody PlatformService.RecoverInput in, jakarta.servlet.http.HttpServletRequest req) {
        service.recover(in, com.brindix.common.ClientIp.of(req));
        return Map.of("message", "Contraseña restablecida. Ya puedes entrar.");
    }

    /** Modo soporte: entrar al bar como su administrador. */
    @PostMapping("/api/platform/venues/{id}/enter")
    public StaffDtos.LoginResponse enter(@PathVariable Long id) {
        return service.enter(CurrentUser.get(), id);
    }

    @PostMapping("/api/platform/venues/{id}/reset-admin")
    public void reset(@PathVariable Long id, @Valid @RequestBody PlatformService.ResetPassword in) {
        service.resetAdmin(id, in);
    }

    /** Datos públicos de contacto para la landing. */
    @GetMapping("/api/public/site")
    public Map<String, String> site() {
        return Map.of("whatsapp", props.whatsapp() == null ? "" : props.whatsapp(),
                "demoUrl", props.demoUrl() == null ? "" : props.demoUrl());
    }
}
