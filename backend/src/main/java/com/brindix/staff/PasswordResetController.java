package com.brindix.staff;

import com.brindix.common.ClientIp;
import com.brindix.security.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Recuperación de contraseña del personal: pedir, aprobar (bar o plataforma) y restablecer con código. */
@RestController
public class PasswordResetController {

    private final PasswordResetService service;

    public PasswordResetController(PasswordResetService service) {
        this.service = service;
    }

    @PostMapping("/api/auth/forgot")
    public Map<String, String> forgot(@Valid @RequestBody PasswordResetService.ForgotInput in, HttpServletRequest req) {
        service.request(in, ClientIp.of(req));
        return Map.of("message", PasswordResetService.GENERIC);
    }

    @PostMapping("/api/auth/reset")
    public Map<String, String> reset(@Valid @RequestBody PasswordResetService.ResetInput in, HttpServletRequest req) {
        service.reset(in, ClientIp.of(req));
        return Map.of("message", "Listo. Ya puedes entrar con tu nueva contraseña.");
    }

    @GetMapping({"/api/admin/password-requests", "/api/platform/password-requests"})
    public List<PasswordResetService.RequestView> list() {
        return service.list(CurrentUser.get());
    }

    @PostMapping({"/api/admin/password-requests/{id}/approve", "/api/platform/password-requests/{id}/approve"})
    public PasswordResetService.ApprovedCode approve(@PathVariable Long id) {
        return service.approve(CurrentUser.get(), id);
    }

    @PostMapping({"/api/admin/password-requests/{id}/reject", "/api/platform/password-requests/{id}/reject"})
    public void reject(@PathVariable Long id) {
        service.reject(CurrentUser.get(), id);
    }
}
