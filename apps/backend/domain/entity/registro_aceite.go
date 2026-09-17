package entity

// RegistroAceite é o registro imutável do aceite do termo de consentimento LGPD
// por uma sessão. O TTL (5 anos de retenção legal) é calculado pelo adapter a
// partir de AceitoEm.
type RegistroAceite struct {
	SessionID   string
	VersaoTermo string
	// AceitoEm é o instante do aceite em ISO 8601.
	AceitoEm  string
	IP        string
	UserAgent string
}
