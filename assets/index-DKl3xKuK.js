import{I as Ee,F as pe,a as re,b as I,W as Ae,B as le,S as be,V as b,c as Ue,d as K,U as _e,e as Be,f as Q,M as oe,g as k,L as Pe,h as Le,i as Te,j as De,k as Oe,G as he,E as We,A as me,l as Ce,m as Ie,P as Fe,n as Ge,t as je,o as Ne,N as Re,p as He,q as Ve}from"./threeKit-DplwDVZ_.js";import{c as ke,a as te,l as C,F as qe}from"./kit-hJpx083g.js";const ye=new le,$=new b;class ze extends Ee{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type="LineSegmentsGeometry";const e=[-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],t=[-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],i=[0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5];this.setIndex(i),this.setAttribute("position",new pe(e,3)),this.setAttribute("uv",new pe(t,2))}applyMatrix4(e){const t=this.attributes.instanceStart,i=this.attributes.instanceEnd;return t!==void 0&&(t.applyMatrix4(e),i.applyMatrix4(e),t.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));const i=new re(t,6,1);return this.setAttribute("instanceStart",new I(i,3,0)),this.setAttribute("instanceEnd",new I(i,3,3)),this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));const i=new re(t,6,1);return this.setAttribute("instanceColorStart",new I(i,3,0)),this.setAttribute("instanceColorEnd",new I(i,3,3)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new Ae(e.geometry)),this}fromLineSegments(e){const t=e.geometry;return this.setPositions(t.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new le);const e=this.attributes.instanceStart,t=this.attributes.instanceEnd;e!==void 0&&t!==void 0&&(this.boundingBox.setFromBufferAttribute(e),ye.setFromBufferAttribute(t),this.boundingBox.union(ye))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new be),this.boundingBox===null&&this.computeBoundingBox();const e=this.attributes.instanceStart,t=this.attributes.instanceEnd;if(e!==void 0&&t!==void 0){const i=this.boundingSphere.center;this.boundingBox.getCenter(i);let r=0;for(let l=0,d=e.count;l<d;l++)$.fromBufferAttribute(e,l),r=Math.max(r,i.distanceToSquared($)),$.fromBufferAttribute(t,l),r=Math.max(r,i.distanceToSquared($));this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error("THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.",this)}}toJSON(){}applyMatrix(e){return console.warn("THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4()."),this.applyMatrix4(e)}}Q.line={worldUnits:{value:1},linewidth:{value:1},resolution:{value:new Be(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}};K.line={uniforms:_e.merge([Q.common,Q.fog,Q.line]),vertexShader:`
		#include <common>
		#include <color_pars_vertex>
		#include <fog_pars_vertex>
		#include <logdepthbuf_pars_vertex>
		#include <clipping_planes_pars_vertex>

		uniform float linewidth;
		uniform vec2 resolution;

		attribute vec3 instanceStart;
		attribute vec3 instanceEnd;

		attribute vec3 instanceColorStart;
		attribute vec3 instanceColorEnd;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#ifdef USE_DASH

			uniform float dashScale;
			attribute float instanceDistanceStart;
			attribute float instanceDistanceEnd;
			varying float vLineDistance;

		#endif

		void trimSegment( const in vec4 start, inout vec4 end ) {

			// trim end segment so it terminates between the camera plane and the near plane

			// conservative estimate of the near plane
			float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
			float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
			float nearEstimate = - 0.5 * b / a;

			float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

			end.xyz = mix( start.xyz, end.xyz, alpha );

		}

		void main() {

			#ifdef USE_COLOR

				vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

			#endif

			#ifdef USE_DASH

				vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
				vUv = uv;

			#endif

			float aspect = resolution.x / resolution.y;

			// camera space
			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

			#ifdef WORLD_UNITS

				worldStart = start.xyz;
				worldEnd = end.xyz;

			#else

				vUv = uv;

			#endif

			// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
			// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
			// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
			// perhaps there is a more elegant solution -- WestLangley

			bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

			if ( perspective ) {

				if ( start.z < 0.0 && end.z >= 0.0 ) {

					trimSegment( start, end );

				} else if ( end.z < 0.0 && start.z >= 0.0 ) {

					trimSegment( end, start );

				}

			}

			// clip space
			vec4 clipStart = projectionMatrix * start;
			vec4 clipEnd = projectionMatrix * end;

			// ndc space
			vec3 ndcStart = clipStart.xyz / clipStart.w;
			vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

			// direction
			vec2 dir = ndcEnd.xy - ndcStart.xy;

			// account for clip-space aspect ratio
			dir.x *= aspect;
			dir = normalize( dir );

			#ifdef WORLD_UNITS

				vec3 worldDir = normalize( end.xyz - start.xyz );
				vec3 tmpFwd = normalize( mix( start.xyz, end.xyz, 0.5 ) );
				vec3 worldUp = normalize( cross( worldDir, tmpFwd ) );
				vec3 worldFwd = cross( worldDir, worldUp );
				worldPos = position.y < 0.5 ? start: end;

				// height offset
				float hw = linewidth * 0.5;
				worldPos.xyz += position.x < 0.0 ? hw * worldUp : - hw * worldUp;

				// don't extend the line if we're rendering dashes because we
				// won't be rendering the endcaps
				#ifndef USE_DASH

					// cap extension
					worldPos.xyz += position.y < 0.5 ? - hw * worldDir : hw * worldDir;

					// add width to the box
					worldPos.xyz += worldFwd * hw;

					// endcaps
					if ( position.y > 1.0 || position.y < 0.0 ) {

						worldPos.xyz -= worldFwd * 2.0 * hw;

					}

				#endif

				// project the worldpos
				vec4 clip = projectionMatrix * worldPos;

				// shift the depth of the projected points so the line
				// segments overlap neatly
				vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
				clip.z = clipPose.z * clip.w;

			#else

				vec2 offset = vec2( dir.y, - dir.x );
				// undo aspect ratio adjustment
				dir.x /= aspect;
				offset.x /= aspect;

				// sign flip
				if ( position.x < 0.0 ) offset *= - 1.0;

				// endcaps
				if ( position.y < 0.0 ) {

					offset += - dir;

				} else if ( position.y > 1.0 ) {

					offset += dir;

				}

				// adjust for linewidth
				offset *= linewidth;

				// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
				offset /= resolution.y;

				// select end
				vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

				// back to clip space
				offset *= clip.w;

				clip.xy += offset;

			#endif

			gl_Position = clip;

			vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

			#include <logdepthbuf_vertex>
			#include <clipping_planes_vertex>
			#include <fog_vertex>

		}
		`,fragmentShader:`
		uniform vec3 diffuse;
		uniform float opacity;
		uniform float linewidth;

		#ifdef USE_DASH

			uniform float dashOffset;
			uniform float dashSize;
			uniform float gapSize;

		#endif

		varying float vLineDistance;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#include <common>
		#include <color_pars_fragment>
		#include <fog_pars_fragment>
		#include <logdepthbuf_pars_fragment>
		#include <clipping_planes_pars_fragment>

		vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

			float mua;
			float mub;

			vec3 p13 = p1 - p3;
			vec3 p43 = p4 - p3;

			vec3 p21 = p2 - p1;

			float d1343 = dot( p13, p43 );
			float d4321 = dot( p43, p21 );
			float d1321 = dot( p13, p21 );
			float d4343 = dot( p43, p43 );
			float d2121 = dot( p21, p21 );

			float denom = d2121 * d4343 - d4321 * d4321;

			float numer = d1343 * d4321 - d1321 * d4343;

			mua = numer / denom;
			mua = clamp( mua, 0.0, 1.0 );
			mub = ( d1343 + d4321 * ( mua ) ) / d4343;
			mub = clamp( mub, 0.0, 1.0 );

			return vec2( mua, mub );

		}

		void main() {

			#include <clipping_planes_fragment>

			#ifdef USE_DASH

				if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

				if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

			#endif

			float alpha = opacity;

			#ifdef WORLD_UNITS

				// Find the closest points on the view ray and the line segment
				vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
				vec3 lineDir = worldEnd - worldStart;
				vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

				vec3 p1 = worldStart + lineDir * params.x;
				vec3 p2 = rayEnd * params.y;
				vec3 delta = p1 - p2;
				float len = length( delta );
				float norm = len / linewidth;

				#ifndef USE_DASH

					#ifdef USE_ALPHA_TO_COVERAGE

						float dnorm = fwidth( norm );
						alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

					#else

						if ( norm > 0.5 ) {

							discard;

						}

					#endif

				#endif

			#else

				#ifdef USE_ALPHA_TO_COVERAGE

					// artifacts appear on some hardware if a derivative is taken within a conditional
					float a = vUv.x;
					float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
					float len2 = a * a + b * b;
					float dlen = fwidth( len2 );

					if ( abs( vUv.y ) > 1.0 ) {

						alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

					}

				#else

					if ( abs( vUv.y ) > 1.0 ) {

						float a = vUv.x;
						float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
						float len2 = a * a + b * b;

						if ( len2 > 1.0 ) discard;

					}

				#endif

			#endif

			vec4 diffuseColor = vec4( diffuse, alpha );

			#include <logdepthbuf_fragment>
			#include <color_fragment>

			gl_FragColor = vec4( diffuseColor.rgb, alpha );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>
			#include <fog_fragment>
			#include <premultiplied_alpha_fragment>

		}
		`};class ae extends Ue{constructor(e){super({type:"LineMaterial",uniforms:_e.clone(K.line.uniforms),vertexShader:K.line.vertexShader,fragmentShader:K.line.fragmentShader,clipping:!0}),this.isLineMaterial=!0,this.setValues(e)}get color(){return this.uniforms.diffuse.value}set color(e){this.uniforms.diffuse.value=e}get worldUnits(){return"WORLD_UNITS"in this.defines}set worldUnits(e){e===!0?this.defines.WORLD_UNITS="":delete this.defines.WORLD_UNITS}get linewidth(){return this.uniforms.linewidth.value}set linewidth(e){this.uniforms.linewidth&&(this.uniforms.linewidth.value=e)}get dashed(){return"USE_DASH"in this.defines}set dashed(e){e===!0!==this.dashed&&(this.needsUpdate=!0),e===!0?this.defines.USE_DASH="":delete this.defines.USE_DASH}get dashScale(){return this.uniforms.dashScale.value}set dashScale(e){this.uniforms.dashScale.value=e}get dashSize(){return this.uniforms.dashSize.value}set dashSize(e){this.uniforms.dashSize.value=e}get dashOffset(){return this.uniforms.dashOffset.value}set dashOffset(e){this.uniforms.dashOffset.value=e}get gapSize(){return this.uniforms.gapSize.value}set gapSize(e){this.uniforms.gapSize.value=e}get opacity(){return this.uniforms.opacity.value}set opacity(e){this.uniforms&&(this.uniforms.opacity.value=e)}get resolution(){return this.uniforms.resolution.value}set resolution(e){this.uniforms.resolution.value.copy(e)}get alphaToCoverage(){return"USE_ALPHA_TO_COVERAGE"in this.defines}set alphaToCoverage(e){this.defines&&(e===!0!==this.alphaToCoverage&&(this.needsUpdate=!0),e===!0?this.defines.USE_ALPHA_TO_COVERAGE="":delete this.defines.USE_ALPHA_TO_COVERAGE)}}const ne=new k,ve=new b,ge=new b,u=new k,p=new k,z=new k,ie=new b,se=new Le,h=new Pe,we=new b,J=new le,Z=new be,M=new k;let E,T;function xe(o,e,t){return M.set(0,0,-e,1).applyMatrix4(o.projectionMatrix),M.multiplyScalar(1/M.w),M.x=T/t.width,M.y=T/t.height,M.applyMatrix4(o.projectionMatrixInverse),M.multiplyScalar(1/M.w),Math.abs(Math.max(M.x,M.y))}function Ye(o,e){const t=o.matrixWorld,i=o.geometry,r=i.attributes.instanceStart,l=i.attributes.instanceEnd,d=Math.min(i.instanceCount,r.count);for(let s=0,v=d;s<v;s++){h.start.fromBufferAttribute(r,s),h.end.fromBufferAttribute(l,s),h.applyMatrix4(t);const g=new b,w=new b;E.distanceSqToSegment(h.start,h.end,w,g),w.distanceTo(g)<T*.5&&e.push({point:w,pointOnLine:g,distance:E.origin.distanceTo(w),object:o,face:null,faceIndex:s,uv:null,uv1:null})}}function Xe(o,e,t){const i=e.projectionMatrix,l=o.material.resolution,d=o.matrixWorld,s=o.geometry,v=s.attributes.instanceStart,g=s.attributes.instanceEnd,w=Math.min(s.instanceCount,v.count),m=-e.near;E.at(1,z),z.w=1,z.applyMatrix4(e.matrixWorldInverse),z.applyMatrix4(i),z.multiplyScalar(1/z.w),z.x*=l.x/2,z.y*=l.y/2,z.z=0,ie.copy(z),se.multiplyMatrices(e.matrixWorldInverse,d);for(let S=0,F=w;S<F;S++){if(u.fromBufferAttribute(v,S),p.fromBufferAttribute(g,S),u.w=1,p.w=1,u.applyMatrix4(se),p.applyMatrix4(se),u.z>m&&p.z>m)continue;if(u.z>m){const A=u.z-p.z,U=(u.z-m)/A;u.lerp(p,U)}else if(p.z>m){const A=p.z-u.z,U=(p.z-m)/A;p.lerp(u,U)}u.applyMatrix4(i),p.applyMatrix4(i),u.multiplyScalar(1/u.w),p.multiplyScalar(1/p.w),u.x*=l.x/2,u.y*=l.y/2,p.x*=l.x/2,p.y*=l.y/2,h.start.copy(u),h.start.z=0,h.end.copy(p),h.end.z=0;const G=h.closestPointToPointParameter(ie,!0);h.at(G,we);const y=Te.lerp(u.z,p.z,G),j=y>=-1&&y<=1,N=ie.distanceTo(we)<T*.5;if(j&&N){h.start.fromBufferAttribute(v,S),h.end.fromBufferAttribute(g,S),h.start.applyMatrix4(d),h.end.applyMatrix4(d);const A=new b,U=new b;E.distanceSqToSegment(h.start,h.end,U,A),t.push({point:U,pointOnLine:A,distance:E.origin.distanceTo(U),object:o,face:null,faceIndex:S,uv:null,uv1:null})}}}class Se extends oe{constructor(e=new ze,t=new ae({color:Math.random()*16777215})){super(e,t),this.isLineSegments2=!0,this.type="LineSegments2"}computeLineDistances(){const e=this.geometry,t=e.attributes.instanceStart,i=e.attributes.instanceEnd,r=new Float32Array(2*t.count);for(let d=0,s=0,v=t.count;d<v;d++,s+=2)ve.fromBufferAttribute(t,d),ge.fromBufferAttribute(i,d),r[s]=s===0?0:r[s-1],r[s+1]=r[s]+ve.distanceTo(ge);const l=new re(r,2,1);return e.setAttribute("instanceDistanceStart",new I(l,1,0)),e.setAttribute("instanceDistanceEnd",new I(l,1,1)),this}raycast(e,t){const i=this.material.worldUnits,r=e.camera;r===null&&!i&&console.error('LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.');const l=e.params.Line2!==void 0&&e.params.Line2.threshold||0;E=e.ray;const d=this.matrixWorld,s=this.geometry,v=this.material;T=v.linewidth+l,s.boundingSphere===null&&s.computeBoundingSphere(),Z.copy(s.boundingSphere).applyMatrix4(d);let g;if(i)g=T*.5;else{const m=Math.max(r.near,Z.distanceToPoint(E.origin));g=xe(r,m,v.resolution)}if(Z.radius+=g,E.intersectsSphere(Z)===!1)return;s.boundingBox===null&&s.computeBoundingBox(),J.copy(s.boundingBox).applyMatrix4(d);let w;if(i)w=T*.5;else{const m=Math.max(r.near,J.distanceToPoint(E.origin));w=xe(r,m,v.resolution)}J.expandByScalar(w),E.intersectsBox(J)!==!1&&(i?Ye(this,t):Xe(this,r,t))}onBeforeRender(e){const t=this.material.uniforms;t&&t.resolution&&(e.getViewport(ne),this.material.uniforms.resolution.value.set(ne.z,ne.w))}}function Ze(o){const e=De(o.root,o.width,o.height),t=ke(o.root,o.width,o.height),{scene:i}=e,r=(a,x,c)=>new Ne({color:a,transparent:!0,opacity:x,side:c,depthWrite:!1,blending:Re}),l=[[16727972,.62],[16727972,.62],[10575103,.62],[10575103,.62],[3800954,.8],[8011007,.5]],d=new Oe(1,1,1),s=new oe(d,l.map(([a,x])=>r(a,x*.7,He)));s.renderOrder=1;const v=new oe(d,l.map(([a,x])=>r(a,x,Ve)));v.renderOrder=2;const g=new he;g.add(s,v);const w=new We(d),m=new ze().fromEdgesGeometry(w),S=new ae({color:16777215,linewidth:3,transparent:!0,opacity:1,depthTest:!1}),F=new ae({color:12582880,linewidth:12,transparent:!0,opacity:.22,depthTest:!1,blending:me}),ee=new Se(m,S),G=new Se(m,F);ee.renderOrder=3,G.renderOrder=2;const y=new he;y.add(g,G,ee),y.visible=!1,i.add(y);const j=new Ce,N=60,A=new Float32Array(N*3);for(let a=0;a<N*3;a++)A[a]=Math.random()-.5;j.setAttribute("position",new Ie(A,3));const U=new Fe(j,new Ge({color:15400946,size:3,transparent:!0,opacity:.7,blending:me,depthWrite:!1}));y.add(U);const de=()=>{S.resolution.set(e.w,e.h),F.resolution.set(e.w,e.h)};de();const n={x:0,y:0,len:0,rz:0,ry:.5,rx:.3,s:0};let D=!1,O=0,q=0,Y=0,R=0;const B=new b,P=new b;let ce=0;return{update(a){ce+=a.dt;const x=je(a);t.clear();const c=t.ctx;if(x){q=0;const[f,_]=x;e.toWorld(f.pinchPt.x,f.pinchPt.y,B),e.toWorld(_.pinchPt.x,_.pinchPt.y,P);const W=Math.max(30,B.distanceTo(P)),L=Math.atan2(P.y-B.y,P.x-B.x),H=f.source==="camera"&&_.source==="camera"?te((_.palmSize-f.palmSize)/((f.palmSize+_.palmSize)/2)*1.6,-.9,.9):0,Me=f.source==="camera"&&_.source==="camera"?te((f.roll+_.roll)/2,-1.2,1.2):0;D||(D=!0,n.x=(B.x+P.x)/2,n.y=(B.y+P.y)/2,n.len=W,n.rz=L,n.s=0,R=1,o.audio.pop(420),o.audio.whoosh(!0,.08));const X=.45;n.x=C(n.x,(B.x+P.x)/2,X),n.y=C(n.y,(B.y+P.y)/2,X),n.len=C(n.len,W,X);let V=L-n.rz;for(;V>Math.PI;)V-=Math.PI*2;for(;V<-Math.PI;)V+=Math.PI*2;n.rz+=V*X,n.ry=C(n.ry,.55+H,.2),n.rx=C(n.rx,.35+Me*.8,.2),n.s=C(n.s,1,.25);for(const ue of x)c.beginPath(),c.arc(ue.pinchPt.x,ue.pinchPt.y,14+Math.sin(ce*8)*2,0,Math.PI*2),c.strokeStyle="rgba(57,255,122,0.9)",c.lineWidth=2,c.shadowColor="#39ff7a",c.shadowBlur=14,c.stroke(),c.shadowBlur=0}else D&&(q||(q=a.t),a.t-q>220&&(D=!1,O=1,o.audio.whoosh(!1,.06)));!D&&O>0&&(O=Math.max(0,O-a.dt*1.4),n.s=O,Y+=a.dt*4,n.y+=a.dt*60),!D&&O<=0&&(n.s=0,Y=0);const fe=a.hands.filter(f=>f.pinching);if(!x&&fe.length===1){const f=fe[0].pinchPt;c.beginPath(),c.arc(f.x,f.y,16,0,Math.PI*2),c.strokeStyle="rgba(255,63,164,0.9)",c.lineWidth=2,c.stroke(),c.font=`500 14px ${qe}`,c.fillStyle="rgba(255,255,255,0.9)",c.textAlign="center",c.fillText("另一只手也捏住",f.x,f.y-26)}if(y.visible=n.s>.01,y.visible){R=Math.max(0,R-a.dt*2);const f=n.s*(1+R*.15),_=te(n.len*.55,40,420);y.position.set(n.x,n.y,0),y.rotation.set(0,0,0),y.rotateZ(n.rz),y.rotateY(n.ry+Y),y.rotateX(n.rx+Y*.5),y.scale.set(n.len*f,_*f,_*f);const W=j.attributes.position;for(let L=0;L<N;L++){let H=W.getY(L)+a.dt*.08;H>.5&&(H=-.5),W.setY(L,H)}W.needsUpdate=!0,S.opacity=Math.min(1,n.s*1.2),F.opacity=.22*n.s+R*.3}e.render()},resize(a,x){e.resize(a,x),t.resize(a,x),de()},dispose(){m.dispose(),w.dispose(),e.dispose(),t.dispose()}}}export{Ze as create};
