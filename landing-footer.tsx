import * as React from 'react';
import {createRoot} from 'react-dom/client';
import RidgelineDitherFooter from './components/ui/ridgeline-dither-footer';
export function LandingFooter() {
 return <RidgelineDitherFooter
  preset="glacier" seed={23} ridges={7} maxWidth="100%"
  name="SearchForLeads" brandHref="/#top"
  logo={<img src="/public/loupe-logo.svg" width="30" height="30" alt="" />}
  tagline="Busca de empresas, CRM de leads e indicadores para acompanhar sua prospecção B2B."
  columns={[
   {title:'Navegação',links:[{label:'Como funciona',href:'#como-funciona'},{label:'Recursos',href:'#recursos'},{label:'Dúvidas',href:'#duvidas'},{label:'Entrar',href:'/auth?mode=login'}]},
   {title:'Legal',links:[{label:'Política de Cookies',href:'/politica-de-cookies'},{label:'Termos de Uso',href:'/termos-de-uso'},{label:'Política de Privacidade',href:'/politica-de-privacidade'}]},
   {title:'Conta',links:[{label:'Criar conta',href:'/auth?mode=signup'},{label:'Meu espaço',href:'/app/'},{label:'Voltar ao topo',href:'#top'}]}
  ]}
  socials={[]}
  credit={null}
 />;
}
if (typeof document !== 'undefined') {
 const mount = document.getElementById('ridgeline-footer');
 if (mount) createRoot(mount).render(<LandingFooter/>);
}
