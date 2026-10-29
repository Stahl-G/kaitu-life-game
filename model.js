                                                                       
                                                          
                                        
                                        
                                             
                                                                                     
                                                                                                     
                     
                
               
                   
                   
               
                    
                           
                     
                            
                                              
                                                 
 
/** The player's answer to one choice; option ids belong to that choice, the rest are second-step settings. */
                       
                 
                
                 
                            
                                 
                                                 
 
                         
                     
                    
                            
 
                                                        
                                               
                       
               
                                   
                  
                 
 
                                                               
                        
              
                                   
                                 
                       
                       
                     
                       
                  
                    
                                                                
                             
               
                   
             
                 
                                    
               
                                                                                  
                 
                  
                                                               
                     
                        
                       
               
                                                                                                                     
           
                     
                             
                         
                          
                               
                       
                       
                 
                                                                    
                               
                                                     
    
                  
                                            
                                     
                                                     
                                
                       
                        
                       
               
                 
                          
                   
                 
                                                             
                         
                    
 
/** Year plan applied from a given year onward; the latest plan stays in force. */
                       
               
                 
                   
                 
                         
                    
 
                        
             
             
                                                                             
                                                     
                 
                                  
                                             
                                          
                                                              
                   
 
                         
               
                  
                 
                 
                    
                     
                                                                                 
 
                         
              
                 
             
                                                        
                     
                
 
                          
                   
                 
                                                 
                 
                    
                    
                     
                          
 
                          
               
              
                 
                 
                   
               
                   
                    
                   
 
export const focusLabels                      = {
  work: ["工作", "Work"],
  balanced: ["均衡", "Balance"],
  people: ["家人朋友", "People"],
  health: ["健康", "Health"],
  learning: ["自我提升", "Learning"],
  hobby: ["兴趣", "Interests"],
};
export const focusHints                      = {
  work: ["收入↑ 健康↓ 关系↓", "Pay ↑ health ↓ people ↓"],
  balanced: ["每样都顾一点", "A little of everything"],
  people: ["关系↑ 快乐↑ 知识↓", "People ↑ happiness ↑"],
  health: ["健康↑ 快乐↑", "Health ↑ happiness ↑"],
  learning: ["知识↑ 健康↓", "Knowledge ↑ health ↓"],
  hobby: ["快乐↑ 知识↑", "Happiness ↑ knowledge ↑"],
};
export const decisionLabels                             = {
  career: ["换工作 / 转行", "Change career"],
  business: ["创业", "Start a business"],
  abroad: ["出国", "Move abroad"],
  invest: ["投资", "Invest"],
  study: ["继续读书", "Further study"],
  stay: ["照现在过", "Carry on"],
  custom: ["自定义", "Your own plan"],
};
export const clamp = (n        , min = 0, max = 100) => Math.max(min, Math.min(max, n));
export function changeProps(s       , e                         ) {
  for (const [k, v] of Object.entries(e)) s.props[k             ] = clamp(s.props[k             ] + (v ?? 0));
}
/** Amounts inside story text: ¥12,300 and, for large Chinese amounts, ¥12.3 万. */
export function rmb(fen        )       {
  const v = Math.round(fen / 100);
  const sign = v < 0 ? "−" : "";
  const abs = Math.abs(v);
  const en = `${sign}¥${abs.toLocaleString("en-US")}`;
  if (abs < 100000) return [en, en];
  const wan = abs / 10000;
  return [`${sign}¥${wan >= 100 ? Math.round(wan) : Number(wan.toFixed(1))} 万`, en];
}
