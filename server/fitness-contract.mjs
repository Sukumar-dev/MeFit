// Routes that make up the staged SRS contract. Search is explicitly opt-in.
export const routes = [
  ['GET','health', 'public'],
  ['GET','user', 'user'],
  ['POST','user', 'user'],
  ['GET','user/:id', 'user'],
  ['PATCH','user/:id', 'user'],
  ['DELETE','user/:id', 'user'],
  ['POST','user/:id/update_password', 'user'],
  ...['GET','POST','PUT','PATCH','DELETE'].map((method) => [method,'profile','user']),
  ['GET','goal','user'],
  ['GET','goal/current','user'],
  ['GET','goal/:id','user'],
  ['POST','goal','user'],
  ['PATCH','goal/:id','user'],
  ['DELETE','goal/:id','user'],
  ['PATCH','goal/:id/status','user'],
  ['POST','goal/:id/workouts/:workout/complete','user'],
  ...['program','workout'].flatMap((name) => [
    ['GET',name,'user',true],
    ['GET',name+'s','user',true],
    ['GET',name+'/:id','user'],
    ['POST',name,'contributor'],
    ['PATCH',name+'/:id','contributor'],
    ['DELETE',name+'/:id','contributor'],
  ]),
  ['GET','exercises','user',true],
  ['GET','exercises/:id','user'],
  ['POST','exercise','contributor'],
  ['PATCH','exercise/:id','contributor'],
  ['DELETE','exercise/:id','contributor'],
  ['GET','contributor/content','contributor'],
  ['POST','contributor-request','user'],
  ['GET','contributor-request','user'],
  ['GET','admin/contributor-requests','admin'],
  ['PATCH','admin/contributor-requests/:id','admin'],
  ['GET','admin/users','admin'],
  ['PATCH','admin/user/:id/roles','admin'],
]

export function matchRoute(method, pathname) {
  const segments = pathname.split('/')
  return routes.find(([verb, template]) => {
    if (verb !== method) return false
    const expected = template.split('/')
    return expected.length === segments.length && expected.every((part, index) =>
      part.startsWith(':') ? Boolean(segments[index]) : part === segments[index])
  })
}
