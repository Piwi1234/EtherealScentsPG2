"use client";

import { useState } from "react";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";

const FAQ_GROUPS = [
  {
    title: "Sobre nuestra tienda",
    items: [
      {
        q: "¿Cómo funciona la tienda?",
        a: "Somos una tienda virtual especializada en traer productos a pedido. Trabajamos únicamente con productos originales y de primera calidad, seleccionados para garantizar la mejor experiencia a nuestros clientes.",
      },
      {
        q: "¿Dónde están ubicados y a qué lugares hacen envíos?",
        a: "Estamos ubicados en la ciudad de Santa Cruz, y realizamos envíos a todo el país.",
      },
    ],
  },
  {
    title: "Pedidos y tiempos de entrega",
    items: [
      {
        q: "¿Cuánto tiempo tarda en llegar mi pedido?",
        a: "Los pedidos tardan entre 5 y 8 días hábiles en llegar y ser entregados o enviados, dependiendo de tu ubicación.",
      },
      {
        q: "¿Tienen productos disponibles para entrega inmediata?",
        a: "Sí. Contamos con productos en stock listos para entrega inmediata. Puedes consultar la disponibilidad con cualquiera de nuestros vendedores.",
      },
      {
        q: "¿Debo consultar la disponibilidad antes de realizar un pedido?",
        a: "Sí, es necesario consultar la disponibilidad del producto antes de confirmar tu pedido, ya que el stock puede variar.",
      },
    ],
  },
  {
    title: "Precios y pagos",
    items: [
      {
        q: "¿Los precios del catálogo son fijos?",
        a: "Los precios y la presentación de los productos pueden variar según la fecha de fabricación. Por ello, te recomendamos confirmar el precio final con tu vendedor antes de realizar el pago.",
      },
      {
        q: "¿Cómo funciona el pago para una compra a pedido?",
        a: "Para realizar una compra a pedido es necesario cancelar un adelanto del 30% del valor total, el cual será especificado en una proforma elaborada por el vendedor. El saldo restante se cancela conforme a lo acordado con tu vendedor.",
      },
    ],
  },
  {
    title: "Cambios y devoluciones",
    items: [
      {
        q: "¿Puedo hacer cambios o devoluciones después de recibir mi producto?",
        a: "No se aceptan cambios ni devoluciones una vez que los productos han sido entregados. Te recomendamos verificar que el producto cumpla con tus expectativas antes de confirmar la recepción.",
      },
    ],
  },
  {
    title: "Calidad de los productos",
    items: [
      {
        q: "¿Los productos son originales?",
        a: "Sí, todos nuestros productos son 100% originales y de primera calidad.",
      },
    ],
  },
];

export default function PreventaFaqPage() {
  const [openKey, setOpenKey] = useState<string | null>(`${FAQ_GROUPS[0].title}-0`);

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />

      <section className="landing-section landing-section--faq-dark">
        <div className="landing-container">
          <p className="landing-eyebrow">Preventa</p>
          <h1 className="landing-section-title">Preguntas Frecuentes (FAQ)</h1>
          <p className="landing-section-lead">Todo lo que necesitás saber antes de hacer tu pedido.</p>

          <div className="landing-faq">
            {FAQ_GROUPS.map((group) => (
              <div className="landing-faq-group" key={group.title}>
                <h2 className="landing-faq-group-title">{group.title}</h2>
                {group.items.map((item, i) => {
                  const key = `${group.title}-${i}`;
                  const open = openKey === key;
                  return (
                    <div className={`landing-faq-item${open ? " landing-faq-item--open" : ""}`} key={key}>
                      <button
                        type="button"
                        className="landing-faq-question"
                        aria-expanded={open}
                        onClick={() => setOpenKey(open ? null : key)}
                      >
                        {item.q}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      {open && <p className="landing-faq-answer">{item.a}</p>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <p className="landing-faq-footer">
            ¿Tenés alguna otra pregunta? <a href="#contacto">Contactanos</a> y con gusto te ayudamos.
          </p>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
