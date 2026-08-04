package reproduccionv1

import (
	context "context"
	grpc "google.golang.org/grpc"
	codes "google.golang.org/grpc/codes"
	status "google.golang.org/grpc/status"
)


const _ = grpc.SupportPackageIsVersion9

const (
	ReproduccionService_Health_FullMethodName                = "/yousac.reproduccion.v1.ReproduccionService/Health"
	ReproduccionService_GuardarCheckpoint_FullMethodName     = "/yousac.reproduccion.v1.ReproduccionService/GuardarCheckpoint"
	ReproduccionService_ObtenerCheckpoint_FullMethodName     = "/yousac.reproduccion.v1.ReproduccionService/ObtenerCheckpoint"
	ReproduccionService_HistorialReciente_FullMethodName     = "/yousac.reproduccion.v1.ReproduccionService/HistorialReciente"
	ReproduccionService_RegistrarCalificacion_FullMethodName = "/yousac.reproduccion.v1.ReproduccionService/RegistrarCalificacion"
)

type ReproduccionServiceClient interface {
	Health(ctx context.Context, in *HealthRequest, opts ...grpc.CallOption) (*HealthResponse, error)
	GuardarCheckpoint(ctx context.Context, in *GuardarCheckpointRequest, opts ...grpc.CallOption) (*GuardarCheckpointResponse, error)
	ObtenerCheckpoint(ctx context.Context, in *ObtenerCheckpointRequest, opts ...grpc.CallOption) (*ObtenerCheckpointResponse, error)
	HistorialReciente(ctx context.Context, in *HistorialRecienteRequest, opts ...grpc.CallOption) (*HistorialRecienteResponse, error)
	RegistrarCalificacion(ctx context.Context, in *RegistrarCalificacionRequest, opts ...grpc.CallOption) (*RegistrarCalificacionResponse, error)
}

type reproduccionServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewReproduccionServiceClient(cc grpc.ClientConnInterface) ReproduccionServiceClient {
	return &reproduccionServiceClient{cc}
}

func (c *reproduccionServiceClient) Health(ctx context.Context, in *HealthRequest, opts ...grpc.CallOption) (*HealthResponse, error) {
	cOpts := append([]grpc.CallOption{grpc.StaticMethod()}, opts...)
	out := new(HealthResponse)
	err := c.cc.Invoke(ctx, ReproduccionService_Health_FullMethodName, in, out, cOpts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *reproduccionServiceClient) GuardarCheckpoint(ctx context.Context, in *GuardarCheckpointRequest, opts ...grpc.CallOption) (*GuardarCheckpointResponse, error) {
	cOpts := append([]grpc.CallOption{grpc.StaticMethod()}, opts...)
	out := new(GuardarCheckpointResponse)
	err := c.cc.Invoke(ctx, ReproduccionService_GuardarCheckpoint_FullMethodName, in, out, cOpts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *reproduccionServiceClient) ObtenerCheckpoint(ctx context.Context, in *ObtenerCheckpointRequest, opts ...grpc.CallOption) (*ObtenerCheckpointResponse, error) {
	cOpts := append([]grpc.CallOption{grpc.StaticMethod()}, opts...)
	out := new(ObtenerCheckpointResponse)
	err := c.cc.Invoke(ctx, ReproduccionService_ObtenerCheckpoint_FullMethodName, in, out, cOpts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *reproduccionServiceClient) HistorialReciente(ctx context.Context, in *HistorialRecienteRequest, opts ...grpc.CallOption) (*HistorialRecienteResponse, error) {
	cOpts := append([]grpc.CallOption{grpc.StaticMethod()}, opts...)
	out := new(HistorialRecienteResponse)
	err := c.cc.Invoke(ctx, ReproduccionService_HistorialReciente_FullMethodName, in, out, cOpts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *reproduccionServiceClient) RegistrarCalificacion(ctx context.Context, in *RegistrarCalificacionRequest, opts ...grpc.CallOption) (*RegistrarCalificacionResponse, error) {
	cOpts := append([]grpc.CallOption{grpc.StaticMethod()}, opts...)
	out := new(RegistrarCalificacionResponse)
	err := c.cc.Invoke(ctx, ReproduccionService_RegistrarCalificacion_FullMethodName, in, out, cOpts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}


type ReproduccionServiceServer interface {
	Health(context.Context, *HealthRequest) (*HealthResponse, error)
	GuardarCheckpoint(context.Context, *GuardarCheckpointRequest) (*GuardarCheckpointResponse, error)
	ObtenerCheckpoint(context.Context, *ObtenerCheckpointRequest) (*ObtenerCheckpointResponse, error)
	HistorialReciente(context.Context, *HistorialRecienteRequest) (*HistorialRecienteResponse, error)
	RegistrarCalificacion(context.Context, *RegistrarCalificacionRequest) (*RegistrarCalificacionResponse, error)
	mustEmbedUnimplementedReproduccionServiceServer()
}

type UnimplementedReproduccionServiceServer struct{}

func (UnimplementedReproduccionServiceServer) Health(context.Context, *HealthRequest) (*HealthResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Health not implemented")
}
func (UnimplementedReproduccionServiceServer) GuardarCheckpoint(context.Context, *GuardarCheckpointRequest) (*GuardarCheckpointResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GuardarCheckpoint not implemented")
}
func (UnimplementedReproduccionServiceServer) ObtenerCheckpoint(context.Context, *ObtenerCheckpointRequest) (*ObtenerCheckpointResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ObtenerCheckpoint not implemented")
}
func (UnimplementedReproduccionServiceServer) HistorialReciente(context.Context, *HistorialRecienteRequest) (*HistorialRecienteResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method HistorialReciente not implemented")
}
func (UnimplementedReproduccionServiceServer) RegistrarCalificacion(context.Context, *RegistrarCalificacionRequest) (*RegistrarCalificacionResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method RegistrarCalificacion not implemented")
}
func (UnimplementedReproduccionServiceServer) mustEmbedUnimplementedReproduccionServiceServer() {}
func (UnimplementedReproduccionServiceServer) testEmbeddedByValue()                             {}

type UnsafeReproduccionServiceServer interface {
	mustEmbedUnimplementedReproduccionServiceServer()
}

func RegisterReproduccionServiceServer(s grpc.ServiceRegistrar, srv ReproduccionServiceServer) {

	if t, ok := srv.(interface{ testEmbeddedByValue() }); ok {
		t.testEmbeddedByValue()
	}
	s.RegisterService(&ReproduccionService_ServiceDesc, srv)
}

func _ReproduccionService_Health_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(HealthRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(ReproduccionServiceServer).Health(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: ReproduccionService_Health_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(ReproduccionServiceServer).Health(ctx, req.(*HealthRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _ReproduccionService_GuardarCheckpoint_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GuardarCheckpointRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(ReproduccionServiceServer).GuardarCheckpoint(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: ReproduccionService_GuardarCheckpoint_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(ReproduccionServiceServer).GuardarCheckpoint(ctx, req.(*GuardarCheckpointRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _ReproduccionService_ObtenerCheckpoint_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ObtenerCheckpointRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(ReproduccionServiceServer).ObtenerCheckpoint(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: ReproduccionService_ObtenerCheckpoint_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(ReproduccionServiceServer).ObtenerCheckpoint(ctx, req.(*ObtenerCheckpointRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _ReproduccionService_HistorialReciente_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(HistorialRecienteRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(ReproduccionServiceServer).HistorialReciente(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: ReproduccionService_HistorialReciente_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(ReproduccionServiceServer).HistorialReciente(ctx, req.(*HistorialRecienteRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _ReproduccionService_RegistrarCalificacion_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(RegistrarCalificacionRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(ReproduccionServiceServer).RegistrarCalificacion(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: ReproduccionService_RegistrarCalificacion_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(ReproduccionServiceServer).RegistrarCalificacion(ctx, req.(*RegistrarCalificacionRequest))
	}
	return interceptor(ctx, in, info, handler)
}

var ReproduccionService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "yousac.reproduccion.v1.ReproduccionService",
	HandlerType: (*ReproduccionServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "Health",
			Handler:    _ReproduccionService_Health_Handler,
		},
		{
			MethodName: "GuardarCheckpoint",
			Handler:    _ReproduccionService_GuardarCheckpoint_Handler,
		},
		{
			MethodName: "ObtenerCheckpoint",
			Handler:    _ReproduccionService_ObtenerCheckpoint_Handler,
		},
		{
			MethodName: "HistorialReciente",
			Handler:    _ReproduccionService_HistorialReciente_Handler,
		},
		{
			MethodName: "RegistrarCalificacion",
			Handler:    _ReproduccionService_RegistrarCalificacion_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "reproduccion.proto",
}
