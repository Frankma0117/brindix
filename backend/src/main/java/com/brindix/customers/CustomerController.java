package com.brindix.customers;

import com.brindix.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class CustomerController {

    private final CustomerService customers;

    public CustomerController(CustomerService customers) {
        this.customers = customers;
    }

    // ---------- Mesero y administrador (elegir o crear cliente al cobrar a fiado) ----------

    @GetMapping("/api/staff/customers/options")
    public List<CustomerDtos.Option> options() {
        return customers.options(CurrentUser.venueId());
    }

    @PostMapping("/api/staff/customers")
    public CustomerDtos.Option quick(@Valid @RequestBody CustomerDtos.QuickInput in) {
        CustomerDtos.Row r = customers.create(CurrentUser.get(), new CustomerDtos.CustomerInput(in.name(), in.phone(), null, null));
        return new CustomerDtos.Option(r.id(), r.name(), r.phone(), r.balance(), r.preferred());
    }

    // ---------- Administrador ----------

    @GetMapping("/api/admin/customers")
    public CustomerDtos.Overview list(@RequestParam(defaultValue = "false") boolean debtors) {
        return customers.overview(CurrentUser.venueId(), debtors);
    }

    @PostMapping("/api/admin/customers")
    public CustomerDtos.Row create(@Valid @RequestBody CustomerDtos.CustomerInput in) {
        return customers.create(CurrentUser.get(), in);
    }

    @PutMapping("/api/admin/customers/{id}")
    public CustomerDtos.Row update(@PathVariable Long id, @Valid @RequestBody CustomerDtos.CustomerInput in) {
        return customers.update(CurrentUser.get(), id, in);
    }

    @DeleteMapping("/api/admin/customers/{id}")
    public void archive(@PathVariable Long id) {
        customers.archive(CurrentUser.get(), id);
    }

    @GetMapping("/api/admin/customers/{id}")
    public CustomerDtos.Detail detail(@PathVariable Long id) {
        return customers.detail(CurrentUser.venueId(), id);
    }

    @PostMapping("/api/admin/customers/{id}/payments")
    public CustomerDtos.Detail addPayment(@PathVariable Long id, @Valid @RequestBody CustomerDtos.PaymentInput in) {
        return customers.addPayment(CurrentUser.get(), id, in);
    }

    @PostMapping("/api/admin/customer-payments/{id}/void")
    public CustomerDtos.Detail voidPayment(@PathVariable Long id) {
        return customers.voidPayment(CurrentUser.get(), id);
    }
}
