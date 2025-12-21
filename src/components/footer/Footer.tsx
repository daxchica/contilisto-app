import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="mt-16 bg-white">
      {/* top divider glow */}
      <div className="h-[2px] w-full bg-gradient-to-r from-blue-600/0 via-blue-600/40 to-blue-600/0" />

      <div className="max-w-6xl mx-auto w-full px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">

          {/* Brand / short pitch */}
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-blue-700 font-extrabold text-xl"
              aria-label="Volver al inicio"
            >
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600 shadow-sm" />
              Contilisto
            </Link>
            <p className="mt-3 text-sm text-gray-600 leading-6">
              Contabilidad automatizada para PYMES en Ecuador. Sube tus PDFs,
              deja que la IA contabilice y descarga tus reportes en minutos.
            </p>

            {/* social */}
            <div className="mt-4 flex items-center gap-3 text-gray-500">
              <a
                href="https://x.com/"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 hover:border-blue-500 hover:text-blue-600"
                aria-label="X / Twitter"
              >
                ✖️
              </a>
              <a
                href="https://www.facebook.com/"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 hover:border-blue-500 hover:text-blue-600"
                aria-label="Facebook"
              >
                👍
              </a>
              <a
                href="https://www.linkedin.com/"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 hover:border-blue-500 hover:text-blue-600"
                aria-label="LinkedIn"
              >
                💼
              </a>
              <a
                href="https://www.instagram.com/"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 hover:border-blue-500 hover:text-blue-600"
                aria-label="Instagram"
              >
                📸
              </a>
            </div>
          </div>

          {/* Producto */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Producto</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li><Link to="/dashboard" className="hover:text-blue-700">Tablero</Link></li>
              <li><Link to="/libros-auxiliares" className="hover:text-blue-700">Libro Mayor</Link></li>
              <li><Link to="/libroBancos" className="hover:text-blue-700">Libro Bancos</Link></li>
              <li><Link to="/estados-financieros" className="hover:text-blue-700">Estados Financieros</Link></li>
            </ul>
          </div>

          {/* Recursos */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Recursos</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li><Link to="/precios" className="hover:text-blue-700">Precios</Link></li>
              <li><Link to="/faq" className="hover:text-blue-700">Preguntas frecuentes</Link></li>
              <li><Link to="/contact" className="hover:text-blue-700">Soporte</Link></li>
              <li>
                <a
                  href="mailto:hola@contilisto.com"
                  className="hover:text-blue-700"
                >
                  hola@contilisto.com
                </a>
              </li>
            </ul>
          </div>

          {/* Suscripción breve (opcional) */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Novedades</h3>
            <p className="mt-3 text-sm text-gray-600">
              Recibe actualizaciones y tips contables.
            </p>
            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                alert("¡Gracias! Te notificaremos por correo. ✉️");
              }}
            >
              <input
                type="email"
                required
                placeholder="tu@email.com"
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              />
              <button
                type="submit"
                className="rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600/50"
              >
                Suscribirme
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* bottom bar */}
      <div className="border-t border-gray-200">
        <div className="max-w-6xl mx-auto w-full px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Contilisto. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <Link to="/terminos" className="hover:text-blue-700">Términos</Link>
            <Link to="/privacidad" className="hover:text-blue-700">Privacidad</Link>
            <Link to="/cookies" className="hover:text-blue-700">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}