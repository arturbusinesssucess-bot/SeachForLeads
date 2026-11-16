import * as React from 'react';
import {createRoot} from 'react-dom/client';
import RidgelineDitherFooter from './components/ui/ridgeline-dither-footer';
export function LandingFooter() {
 return <RidgelineDitherFooter
  preset="glacier" seed={23} ridges={7} maxWidth="100%"
  name="SearchForLeads" brandHref="/#top"
  logo={<img src="/public/loupe-logo.svg" width="30" height="30" alt="" />}
  tagline="Planejamento de expedições para equipes que vão mais longe — rotas, autorizações e previsão do tempo em um só lugar."
  columns={[
   {title:'Navegação',links:[{label:'Como funciona',href:'#como-funciona'},{label:'Recursos',href:'#recursos'},{label:'Dúvidas',href:'#duvidas'},{label:'Entrar',href:'/auth?mode=login'}]},
   {title:'Ajuda',links:[{label:'Dúvidas frequentes',href:'#duvidas'},{label:'Fale com a gente',href:'https://wa.me/5573999844036'},{label:'E-mail',href:'mailto:artur.business.sucess@gmail.com'},{label:'Entrar na conta',href:'/auth?mode=login'}]},
   {title:'Conta',links:[{label:'Criar conta',href:'/auth?mode=signup'},{label:'Meu espaço',href:'/app/'},{label:'Voltar ao topo',href:'#top'}]}
  ]}
  socials={[{icon:'instagram',href:'https://instagram.com'}]}
  credit={null}
 />;
}
if (typeof document !== 'undefined') {
 const mount = document.getElementById('ridgeline-footer');
 if (mount) createRoot(mount).render(<LandingFooter/>);
}
